"use client";

import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "@/lib/cn";

const SYMBOL_PALETTES: { label: string; symbols: string[] }[] = [
  {
    label: "Greek",
    symbols: ["α", "β", "γ", "δ", "ε", "θ", "λ", "μ", "σ", "φ", "ω", "π", "Δ", "Σ", "Π", "Ω"],
  },
  {
    label: "Relations",
    symbols: ["≤", "≥", "≠", "≈", "∝", "∈", "∉", "⊂", "∪", "∩", "∀", "∃"],
  },
  {
    label: "Ops",
    symbols: ["√", "∫", "∑", "∏", "∂", "∇", "∞", "·", "×", "±", "→", "↔", "⇒"],
  },
  { label: "Trig", symbols: ["sin", "cos", "tan", "cot", "sec", "csc", "ln", "log"] },
];

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 min-w-8 rounded-lg border px-2 text-xs font-medium transition-colors",
        active
          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--accent-2)]"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
      )}
    >
      {children}
    </button>
  );
}

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder ?? "Write here…",
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose-editor ProseMirror min-h-[140px] px-3 py-2 text-sm text-zinc-900 outline-none max-w-none [&_p.is-editor-empty:first-child]:before:text-zinc-400 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:pointer-events-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const cur = editor.getHTML();
    if (value !== cur) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  const insert = React.useCallback(
    (chunk: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(chunk).run();
    },
    [editor],
  );

  if (!editor) {
    return (
      <div className={cn("rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500", className)}>
        Loading editor…
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2 rounded-xl border border-zinc-200 bg-white", className)}>
      <div className="flex flex-wrap gap-1 border-b border-zinc-100 p-2">
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </ToolbarButton>
      </div>
      <div className="flex flex-wrap gap-1 px-2 pb-1">
        <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Insert symbols</span>
        {SYMBOL_PALETTES.map((g) => (
          <div key={g.label} className="flex flex-wrap gap-0.5 py-0.5">
            <span className="text-[10px] text-zinc-500 w-full">{g.label}</span>
            {g.symbols.map((s) => (
              <button
                key={`${g.label}-${s}`}
                type="button"
                onClick={() => insert(s)}
                className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs hover:bg-zinc-100"
              >
                {s}
              </button>
            ))}
          </div>
        ))}
        <button
          type="button"
          onClick={() => insert("⃗")}
          className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs hover:bg-zinc-100"
          title="Combining right arrow (vector)"
        >
          vector ⃗
        </button>
      </div>
      <EditorContent editor={editor} className="[&_.ProseMirror]:min-h-[140px]" />
    </div>
  );
}
