interface PageContainerProps {
  children: React.ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="ml-[280px] min-h-screen">
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        {children}
      </div>
    </div>
  );
}
