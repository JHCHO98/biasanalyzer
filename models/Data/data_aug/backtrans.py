import pandas as pd
import torch
import time
import os
import re
from tqdm import tqdm
from deep_translator import GoogleTranslator
from sentence_transformers import SentenceTransformer, util

# 1. 경로 및 설정
INPUT_PATH = 'data_raw/data_channel_extended.csv'
OUTPUT_PATH = 'augmented_final_result_ja.csv'
CHECKPOINT_PATH = 'augmented_checkpoint_ja.csv'
MAX_COMMENTS_PER_ROW = 25 

device = "cpu"
model = SentenceTransformer('snunlp/KR-SBERT-V40K-klueNLI-augSTS', device=device)

# 2. 전처리 함수: 이모티콘 및 불필요한 특수문자 제거
def clean_text(text):
    if not text: return ""
    # 1. 이모지 및 특수 기호 제거 (한글, 영문, 숫자, 기본 문장부호만 남김)
    text = re.sub(r'[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\s?.,!]', ' ', str(text))
    # 2. 연속된 공백 제거
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def split_by_char_limit(texts, limit=4000):
    chunks, current_chunk, current_length = [], [], 0
    for t in texts:
        t_str = clean_text(t)[:limit] # 여기서 전처리 실행
        if not t_str: continue
        if current_length + len(t_str) > limit:
            chunks.append(current_chunk)
            current_chunk, current_length = [t_str], len(t_str)
        else:
            current_chunk.append(t_str)
            current_length += len(t_str)
    if current_chunk: chunks.append(current_chunk)
    return chunks

def safe_batch_translate(texts):
    if not texts: return []
    final_translated = []
    chunks = split_by_char_limit(texts, limit=4000)
    for chunk in chunks:
        try:
            # KO -> JA (일본어 경유가 한국어 증강에 더 효과적)
            ja_chunk = GoogleTranslator(source='ko', target='ja').translate_batch(chunk)
            time.sleep(0.6) 
            # JA -> KO
            ko_chunk = GoogleTranslator(source='ja', target='ko').translate_batch(ja_chunk)
            final_translated.extend(ko_chunk)
            time.sleep(0.6)
        except Exception as e:
            print(f"\n[!] 번역 오류: {e}")
            final_translated.extend(chunk)
    return final_translated

# 3. 데이터 로드 및 이어하기 로직 (기존과 동일)
df = pd.read_csv(INPUT_PATH)
if os.path.exists(CHECKPOINT_PATH):
    df_checkpoint = pd.read_csv(CHECKPOINT_PATH)
    processed_urls = set(df_checkpoint['url'].unique())
    augmented_rows = df_checkpoint.to_dict('records')
    print(f"[*] 체크포인트 발견: {len(processed_urls)}개 처리됨.")
else:
    processed_urls, augmented_rows = set(), []
    print("[*] 처음부터 시작합니다.")

remaining_df = df[~df['url'].isin(processed_urls)]

# 4. 메인 루프
for idx, row in tqdm(remaining_df.iterrows(), total=len(remaining_df), desc="증강 진행 중"):
    try:
        # Title 증강 (클리닝 포함)
        orig_title_clean = clean_text(row['title'])
        aug_title = safe_batch_translate([orig_title_clean])[0]
        
        # Comment 분리 및 25개 제한
        all_comments = [clean_text(c) for c in str(row['comment']).split('|||') if clean_text(c)]
        orig_comments = all_comments[:MAX_COMMENTS_PER_ROW]
        
        if not orig_comments:
            aug_comment_str = ""
        else:
            aug_comments_raw = safe_batch_translate(orig_comments)
            
            with torch.no_grad():
                emb_orig = model.encode(orig_comments, convert_to_tensor=True)
                emb_aug = model.encode(aug_comments_raw, convert_to_tensor=True)
                scores = util.pytorch_cos_sim(emb_orig, emb_aug).diagonal()
            
            final_comments = []
            for o, a, s in zip(orig_comments, aug_comments_raw, scores):
                # 필터링 범위를 0.5 ~ 0.99로 넓혀서 변화를 더 많이 수용
                final_comments.append(a)
                # if 0.50 <= s.item() <= 0.99:
                # else:
                #     final_comments.append(o)
            aug_comment_str = "|||".join(final_comments)
            
        new_row = {'url': row['url'], 'title': aug_title, 'comment': aug_comment_str}
        augmented_rows.append(new_row)

        if len(augmented_rows) % 10 == 0:
            pd.DataFrame(augmented_rows).to_csv(CHECKPOINT_PATH, index=False, encoding='utf-8-sig')
    except KeyboardInterrupt:
        print("\n[!] 중단됨. 현재까지 저장 중...")
        pd.DataFrame(augmented_rows).to_csv(CHECKPOINT_PATH, index=False, encoding='utf-8-sig')
        break
    except Exception as e:
        print(f"\n[!] {idx}행 에러: {e}")
        continue

# 5. 최종 저장
pd.DataFrame(augmented_rows).to_csv(OUTPUT_PATH, index=False, encoding='utf-8-sig')
print(f"\n✅ 완료! 결과 파일: {OUTPUT_PATH}")