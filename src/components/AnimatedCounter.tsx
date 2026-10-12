import React from 'react';

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export function AnimatedCounter({ value, className = '' }: AnimatedCounterProps) {
  // Форматируем число по стандарту ru-RU (например: "9 268")
  const formatted = Math.round(value).toLocaleString('ru-RU');

  return (
    <span className={`inline-flex items-center overflow-hidden ${className}`}>
      {formatted.split('').map((char, index) => {
        // Если это цифра от 0 до 9, делаем для неё анимируемую колонку
        if (/\d/.test(char)) {
          const digit = parseInt(char, 10);
          return (
            <span 
              key={index} 
              className="relative inline-block h-[1em] overflow-hidden align-baseline"
              style={{ width: '0.6em' }}
            >
              <span
                className="absolute left-0 top-0 flex flex-col transition-transform duration-500 ease-out"
                style={{
                  transform: `translateY(-${digit * 10}%)`,
                }}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <span key={n} className="flex h-[1em] items-center justify-center">
                    {n}
                  </span>
                ))}
              </span>
            </span>
          );
        }

        // Для пробелов и разделителей (например, тысяч) оставляем статичный символ
        return (
          <span 
            key={index} 
            className="inline-block text-center" 
            style={{ width: char === ' ' ? '0.3em' : 'auto' }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}
