import { useEffect, useRef, type ReactNode } from 'react';

/**
 * 画面の見出し（h1）。画面が表示されたとき、次の 2 つを行う（画面遷移でも、読み上げやキーボード操作の起点を失わないため）:
 *  - ページのタイトルを、画面の名前にする
 *  - 見出しにフォーカスを移す（tabIndex=-1: Tab では止まらず、プログラムからだけフォーカスできる）
 * ホームだけは、タイトルを「Typing」のままにする。
 */
export function PageHeading({
  title,
  home = false,
  srOnly = false,
  className = '',
  children,
}: {
  title: string;
  home?: boolean;
  /** 画面には出さず、読み上げ用にだけ残す */
  srOnly?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = home ? 'Typing' : `${title} - Typing`;
    ref.current?.focus({ preventScroll: true });
  }, [title, home]);
  return (
    <h1 ref={ref} tabIndex={-1} className={`${srOnly ? 'sr-only' : ''} ${className}`.trim()}>
      {children ?? title}
    </h1>
  );
}
