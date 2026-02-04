function HomePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="container mx-auto px-4 py-16">
                <div className="text-center">
                    <h1 className="text-5xl font-bold text-gray-900 mb-4">
                        🎫 TicketBox
                    </h1>
                    <p className="text-xl text-gray-600 mb-8">
                        Nền tảng mua bán vé sự kiện hàng đầu Việt Nam
                    </p>
                    <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl mx-auto">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                            🚀 Frontend đã được khởi tạo thành công!
                        </h2>
                        <div className="text-left space-y-2 text-gray-700">
                            <p>✅ React 18 + TypeScript</p>
                            <p>✅ Vite (Build tool)</p>
                            <p>✅ TailwindCSS (Styling)</p>
                            <p>✅ React Router (Routing)</p>
                            <p>✅ React Query (Data fetching)</p>
                        </div>
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-800">
                                <strong>Tiếp theo:</strong> Chạy <code className="bg-blue-100 px-2 py-1 rounded">npm install</code> để cài đặt dependencies
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HomePage
