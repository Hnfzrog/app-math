import LmsLayout from '@/components/LmsLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <LmsLayout role="admin" userName="Admin Master" pageTitle="Dashboard Admin">
      {children}
    </LmsLayout>
  );
}
