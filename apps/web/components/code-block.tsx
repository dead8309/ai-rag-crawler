"use client";

import type { BundledLanguage } from "shiki";
import ShikiHighlighter, { isInlineCode, type Element } from "react-shiki";
import { memo, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CodeBlockProps = {
  node?: Element | undefined;
  className?: string | undefined;
  children?: ReactNode | undefined;
  [key: string]: any;
};

const CodeBlockPreview = ({
  node,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? (match[1] as BundledLanguage) : undefined;
  const isInline: boolean | undefined = node ? isInlineCode(node) : undefined;

  return !isInline ? (
    <ShikiHighlighter
      language={language as BundledLanguage}
      theme={"vesper"}
      {...props}
    >
      {String(children)}
    </ShikiHighlighter>
  ) : (
    <code
      className={cn(
        `text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`,
        className
      )}
      {...props}
    >
      {children}
    </code>
  );
};

export const CodeBlock = memo(CodeBlockPreview, (prev, next) => {
  return (
    prev.children === next.children &&
    prev.className === next.className &&
    prev.node === next.node
  );
});
