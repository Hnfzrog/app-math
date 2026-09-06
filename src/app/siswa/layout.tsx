import LmsLayout from '@/components/LmsLayout';
import SiswaNotifier from '@/components/SiswaNotifier';

export default function SiswaLayout({ children }: { children: React.ReactNode }) {
  return (
    <LmsLayout role="siswa" userName="Siswa" pageTitle="Portal Siswa">
      <SiswaNotifier />
      {children}
    </LmsLayout>
  );
}
