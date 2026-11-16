import { Panel } from '@/components/ui';

const STEPS = [
  { t: 'Buat request', d: 'Menu Request → Buat request. Pilih tipe, isi detail dan lampiran. Panel “Alur approval” menunjukkan level dan approver yang akan dilalui sebelum Anda mengirim.' },
  { t: 'Approval berjalan berurutan', d: 'Level berikutnya baru aktif setelah level sebelumnya menyetujui. Setiap approver menerima e-mail dan melihat item di Inbox approval.' },
  { t: 'Ditolak? Revisi lalu kirim ulang', d: 'Penolakan di level mana pun mengembalikan request ke pengaju dengan alasan. Buka request → Revisi → Simpan & kirim ulang; approval dimulai lagi dari level pertama.' },
  { t: 'Delegasi saat cuti', d: 'Menu Delegasi → Buat delegasi. Selama periode aktif, penerima dapat memutuskan item Anda, dan keputusannya dicatat atas nama penerima.' },
  { t: 'Simpan dokumen dengan versi', d: 'Unggah ke folder unit Anda. Mengunggah ulang dokumen yang sama menambah versi baru — versi lama tetap dapat diunduh.' },
];

export default function HelpPage() {
  return (
    <>
      <div className="page-head"><div><h1>Panduan singkat</h1><p className="lead">Lima hal yang perlu diketahui untuk bekerja di Digital Office.</p></div></div>
      <Panel>
        <div className="timeline">
          {STEPS.map((s, i) => (
            <div key={s.t} className="tl-item">
              <div className="tl-dot ion"><span className="num tiny">{i + 1}</span></div>
              <div className="tl-body"><h3>{s.t}</h3><p className="ink2" style={{ marginTop: 4, maxWidth: '70ch' }}>{s.d}</p></div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
