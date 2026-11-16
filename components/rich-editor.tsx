'use client';
import { useEffect, useRef } from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Redo2, RemoveFormatting, Underline, Undo2 } from 'lucide-react';
import { PLACEHOLDERS } from '@/lib/edoc';

/** Toolbar editor (bekerja pada elemen contentEditable mana pun yang sedang fokus di halaman). */
export function EditorToolbar({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) {
  const run = (cmd: string, value?: string) => {
    targetRef.current?.focus();
    document.execCommand(cmd, false, value);
    targetRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const B = ({ cmd, value, label, children }: { cmd: string; value?: string; label: string; children: React.ReactNode }) => (
    <button type="button" title={label} aria-label={label} onMouseDown={(e) => { e.preventDefault(); run(cmd, value); }}>{children}</button>
  );
  return (
    <div className="rte-bar" role="toolbar" aria-label="Format teks">
      <select className="select" aria-label="Gaya paragraf" defaultValue="" onChange={(e) => { if (e.target.value) run('formatBlock', e.target.value); e.target.value = ''; }}>
        <option value="" disabled>Paragraf</option>
        <option value="<p>">Teks biasa</option>
        <option value="<h2>">Judul</option>
        <option value="<h3>">Sub judul</option>
        <option value="<blockquote>">Kutipan</option>
      </select>
      <span className="sep" />
      <B cmd="bold" label="Tebal (Ctrl+B)"><Bold /></B>
      <B cmd="italic" label="Miring (Ctrl+I)"><Italic /></B>
      <B cmd="underline" label="Garis bawah (Ctrl+U)"><Underline /></B>
      <span className="sep" />
      <B cmd="insertUnorderedList" label="Daftar poin"><List /></B>
      <B cmd="insertOrderedList" label="Daftar bernomor"><ListOrdered /></B>
      <span className="sep" />
      <B cmd="justifyLeft" label="Rata kiri"><AlignLeft /></B>
      <B cmd="justifyCenter" label="Rata tengah"><AlignCenter /></B>
      <B cmd="justifyRight" label="Rata kanan"><AlignRight /></B>
      <B cmd="justifyFull" label="Rata kiri-kanan"><AlignJustify /></B>
      <span className="sep" />
      <B cmd="removeFormat" label="Hapus format"><RemoveFormatting /></B>
      <B cmd="undo" label="Urungkan"><Undo2 /></B>
      <B cmd="redo" label="Ulangi"><Redo2 /></B>
      <span className="sep" />
      <select className="select" aria-label="Sisipkan isian otomatis" defaultValue="" onChange={(e) => { if (e.target.value) run('insertText', `{{${e.target.value}}}`); e.target.value = ''; }}>
        <option value="" disabled>Sisipkan isian…</option>
        {PLACEHOLDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
    </div>
  );
}

/**
 * Area tulis contentEditable (uncontrolled agar kursor tidak melompat).
 * Konten awal diset ulang hanya saat `resetKey` berubah (mis. ganti template).
 */
export function EditableBody({ initialHtml, resetKey, onChange, innerRef }: {
  initialHtml: string; resetKey: string | number; onChange: (html: string) => void; innerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const last = useRef<string | number | null>(null);
  useEffect(() => {
    if (innerRef.current && last.current !== resetKey) {
      innerRef.current.innerHTML = initialHtml || '<p><br></p>';
      last.current = resetKey;
    }
  }, [resetKey, initialHtml, innerRef]);

  return (
    <div
      ref={innerRef}
      className="body"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Isi naskah"
      onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
      onPaste={(e) => {
        // tempel sebagai teks biasa agar format dari Word/web tidak merusak tata letak
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        const html = text.split(/\r?\n\r?\n/).map((para) => `<p>${para.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!).replace(/\r?\n/g, '<br>')}</p>`).join('');
        document.execCommand('insertHTML', false, html);
        onChange((e.currentTarget as HTMLDivElement).innerHTML);
      }}
    />
  );
}
