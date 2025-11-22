import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";

export default function PublicLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Header />
            {children}
            <Footer />
        </div>
    );
}
