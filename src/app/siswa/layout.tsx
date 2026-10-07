import LmsLayout from '@/components/LmsLayout';

export default function SiswaLayout({ children }: { children: React.ReactNode }) {
  return (
    <LmsLayout role="siswa" userName="Siswa" pageTitle="Portal Siswa">
      {children}
    </LmsLayout>
  );
}
