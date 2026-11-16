'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { post } from '@/lib/api';
import { RequestForm } from '@/components/request-form';
import { useToast } from '@/components/ui';

export default function NewRequestPage() {
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/requests" className="small row" style={{ gap: 4, marginBottom: 8 }}><ChevronLeft size={15} />Kembali ke daftar</Link>
          <h1>Buat request</h1>
          <p className="lead">Isi detail pekerjaan atau pengajuan. Alur approval dipilih otomatis sesuai aturan organisasi.</p>
        </div>
      </div>
      <RequestForm
        onSubmit={async (payload, submit) => {
          const r = await post<any>('/requests', { ...payload, submit });
          toast.ok(submit ? `Request ${r.refCode} dikirim` : `Draft ${r.refCode} disimpan`);
          router.push(`/requests/${r.id}`);
        }}
      />
    </>
  );
}
