'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { post } from '@/lib/api';
import { useToast } from '@/components/ui';
import { EDocEditor } from '@/components/edoc-editor';

export default function NewEDocPage() {
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <div className="page-head"><div>
        <Link href="/e-docs" className="small row" style={{ gap: 4, marginBottom: 8 }}><ChevronLeft size={15} />Naskah dinas</Link>
        <h1>Tulis naskah</h1>
        <p className="lead">Pilih template atau mulai dari kosong, ketik langsung di kertas, lalu tentukan siapa yang memaraf dan menandatangani.</p>
      </div></div>
      <EDocEditor onSave={async (payload, submit) => {
        const d = await post<any>('/e-documents', payload);
        if (submit) {
          try {
            const s = await post<any>(`/e-documents/${d.id}/submit`);
            toast.ok(`Naskah ${s.number} dikirim ke ${s.signers[0]?.user.fullName}`);
          } catch (e: any) {
            toast.bad(`Draft tersimpan, tetapi belum terkirim: ${e.message}`);
          }
        } else toast.ok('Draft disimpan');
        router.push(`/e-docs/${d.id}`);
      }} />
    </>
  );
}
