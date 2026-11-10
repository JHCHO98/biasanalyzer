import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Keep an existing preference; new visitors start with the light theme.
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved === 'dark' ? 'dark' : 'light';
    });

    // 폰트 사이즈 상태 ('xs', 'sm', 'base', 'lg', 'xl')
    const [fontSize, setFontSize] = useState(() => {
        const saved = localStorage.getItem('fontSize');
        return ['xs', 'sm', 'base', 'lg', 'xl'].includes(saved) ? saved : 'base';
    });

    // 테마 및 폰트 사이즈 변경 시 DOM과 localStorage 업데이트
    useEffect(() => {
        localStorage.setItem('theme', theme);
        localStorage.setItem('fontSize', fontSize);
        
        // HTML root에 클래스 적용
        const root = document.documentElement;
        
        // 테마
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        // 폰트 사이즈 (이전 사이즈 클래스 제거 후 새 사이즈 추가)
        root.classList.remove('text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl');
        root.dataset.fontSize = fontSize;
        
    }, [theme, fontSize]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, fontSize, setFontSize }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
