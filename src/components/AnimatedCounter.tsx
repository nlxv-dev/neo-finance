import { formatCurrency } from '@/data/mockData';

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export function AnimatedCounter({ value, className = '' }: AnimatedCounterProps) {
  // Keep one stable, readable value in the accessibility tree. The visual digit
  // columns are hidden from assistive technology so they are not announced as 0123456789.
  const formatted = formatCurrency(Math.round(value));
  const chars = Array.from(formatted);

  return (
    <>
      <span className="sr-only">{formatted}</span>
      <span aria-hidden="true" className={`inline-flex items-center overflow-hidden ${className}`}>
        {chars.map((char, index) => {
          if (/\d/.test(char)) {
            const digit = Number(char);
            const digitsToRight = chars.slice(index + 1).filter((nextChar) => /\d/.test(nextChar)).length;
            return (
              <span
                key={`digit-${digitsToRight + 1}`}
                className="relative inline-block h-[1em] overflow-hidden align-baseline"
                style={{ width: '0.6em' }}
              >
                <span
                  className="absolute left-0 top-0 flex flex-col transition-transform duration-500 ease-out motion-reduce:transition-none"
                  style={{ transform: `translateY(-${digit * 10}%)` }}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
                    <span key={number} className="flex h-[1em] items-center justify-center">
                      {number}
                    </span>
                  ))}
                </span>
              </span>
            );
          }

          const digitsToRight = chars.slice(index + 1).filter((nextChar) => /\d/.test(nextChar)).length;
          return (
            <span
              key={`separator-${char}-${digitsToRight}`}
              className="inline-block text-center"
              style={{ width: char === ' ' ? '0.3em' : 'auto' }}
            >
              {char}
            </span>
          );
        })}
      </span>
    </>
  );
}
