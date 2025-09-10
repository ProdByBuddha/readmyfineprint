import http from 'http';
import url from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 5173;

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

// Complete React app in one HTML file
const appHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ReadMyFinePrint - AI-Powered Contract Analysis</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/react-router-dom@6.26.1/dist/umd/react-router-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .loading { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .spinner { border: 4px solid #f3f4f6; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading">
            <div>
                <div class="spinner"></div>
                <p style="margin-top: 16px; color: #6b7280;">Loading ReadMyFinePrint...</p>
            </div>
        </div>
    </div>
    
    <script type="text/babel" data-type="module">
        const { BrowserRouter, Routes, Route, Link, useNavigate } = ReactRouterDOM;
        const { useState, useEffect } = React;
        
        const API_BASE = 'http://localhost:3001';
        
        function App() {
            return React.createElement(BrowserRouter, null,
                React.createElement('div', { 
                    className: 'min-h-screen bg-gray-50 flex flex-col'
                },
                    React.createElement(Header),
                    React.createElement('main', { 
                        className: 'flex-1 container mx-auto px-4 py-8'
                    },
                        React.createElement(Routes, null,
                            React.createElement(Route, { path: '/', element: React.createElement(Home) }),
                            React.createElement(Route, { path: '/upload', element: React.createElement(Upload) }),
                            React.createElement(Route, { path: '/admin', element: React.createElement(Admin) }),
                            React.createElement(Route, { path: '/subscription', element: React.createElement(Subscription) }),
                            React.createElement(Route, { path: '/privacy', element: React.createElement(Privacy) }),
                            React.createElement(Route, { path: '/terms', element: React.createElement(Terms) }),
                            React.createElement(Route, { path: '*', element: React.createElement(NotFound) })
                        )
                    ),
                    React.createElement(Footer)
                )
            );
        }
        
        function Header() {
            return React.createElement('header', { className: 'bg-white shadow-sm border-b' },
                React.createElement('div', { className: 'container mx-auto px-4 py-4 flex items-center justify-between' },
                    React.createElement(Link, { 
                        to: '/', className: 'text-2xl font-bold text-blue-600 hover:text-blue-700'
                    }, 'ReadMyFinePrint'),
                    React.createElement('nav', { className: 'hidden md:flex space-x-6' },
                        React.createElement(Link, { to: '/', className: 'text-gray-700 hover:text-blue-600' }, 'Home'),
                        React.createElement(Link, { to: '/upload', className: 'text-gray-700 hover:text-blue-600' }, 'Upload'),
                        React.createElement(Link, { to: '/subscription', className: 'text-gray-700 hover:text-blue-600' }, 'Pricing'),
                        React.createElement(Link, { to: '/admin', className: 'text-gray-700 hover:text-blue-600' }, 'Admin')
                    )
                )
            );
        }
        
        function Home() {
            return React.createElement('div', { className: 'text-center space-y-8' },
                React.createElement('div', { className: 'space-y-4' },
                    React.createElement('h1', { className: 'text-5xl font-bold text-gray-900' }, 
                        'Privacy-First Legal Document Analysis'
                    ),
                    React.createElement('p', { className: 'text-xl text-gray-600 max-w-3xl mx-auto' },
                        'Get powerful AI insights from contracts, agreements, and legal documents while keeping your sensitive information completely secure.'
                    )
                ),
                
                React.createElement('div', { className: 'grid md:grid-cols-3 gap-8 my-12' },
                    React.createElement(FeatureCard, { 
                        emoji: '🔒', title: 'Secure Processing',
                        description: 'Your documents are processed with enterprise-grade security. No data is stored permanently.'
                    }),
                    React.createElement(FeatureCard, { 
                        emoji: '⚡', title: 'Instant Analysis',
                        description: 'Get comprehensive analysis results in seconds, not hours. AI-powered insights delivered fast.'
                    }),
                    React.createElement(FeatureCard, { 
                        emoji: '✅', title: 'Plain English',
                        description: 'Complex legal language transformed into clear, understandable summaries and insights.'
                    })
                ),
                
                React.createElement('div', { className: 'flex flex-col sm:flex-row gap-4 justify-center' },
                    React.createElement(Link, { 
                        to: '/upload',
                        className: 'bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold shadow-lg transform hover:scale-105 transition-all'
                    }, '📄 Upload Document'),
                    React.createElement(Link, { 
                        to: '/subscription',
                        className: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-lg text-lg font-semibold transition-all'
                    }, 'View Pricing')
                ),
                
                React.createElement('div', { className: 'mt-16 bg-blue-50 rounded-xl p-8' },
                    React.createElement('h2', { className: 'text-2xl font-bold text-gray-900 mb-4' }, 'How It Works'),
                    React.createElement('div', { className: 'grid md:grid-cols-3 gap-6 text-center' },
                        React.createElement('div', null,
                            React.createElement('div', { className: 'text-4xl mb-2' }, '1️⃣'),
                            React.createElement('h3', { className: 'font-semibold mb-2' }, 'Upload'),
                            React.createElement('p', { className: 'text-gray-600' }, 'Upload your legal document (PDF, DOCX, or text)')
                        ),
                        React.createElement('div', null,
                            React.createElement('div', { className: 'text-4xl mb-2' }, '2️⃣'),
                            React.createElement('h3', { className: 'font-semibold mb-2' }, 'Analyze'),
                            React.createElement('p', { className: 'text-gray-600' }, 'AI analyzes the document with privacy protection')
                        ),
                        React.createElement('div', null,
                            React.createElement('div', { className: 'text-4xl mb-2' }, '3️⃣'),
                            React.createElement('h3', { className: 'font-semibold mb-2' }, 'Understand'),
                            React.createElement('p', { className: 'text-gray-600' }, 'Get clear, actionable insights in plain English')
                        )
                    )
                )
            );
        }
        
        function FeatureCard({ emoji, title, description }) {
            return React.createElement('div', { className: 'text-center p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow' },
                React.createElement('div', { className: 'text-4xl mb-4' }, emoji),
                React.createElement('h3', { className: 'text-xl font-semibold text-gray-900 mb-3' }, title),
                React.createElement('p', { className: 'text-gray-600' }, description)
            );
        }
        
        function Upload() {
            const [file, setFile] = useState(null);
            const [analyzing, setAnalyzing] = useState(false);
            const [result, setResult] = useState(null);
            
            const handleFileSelect = (e) => {
                const selectedFile = e.target.files[0];
                setFile(selectedFile);
                setResult(null);
            };
            
            const handleAnalyze = async () => {
                if (!file) return;
                
                setAnalyzing(true);
                try {
                    const formData = new FormData();
                    formData.append('document', file);
                    
                    const response = await fetch(\`\${API_BASE}/api/document/analyze\`, {
                        method: 'POST',
                        body: formData,
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        setResult(data);
                    } else {
                        const errorText = await response.text();
                        setResult({ error: \`Analysis failed: \${response.status} - \${errorText}\` });
                    }
                } catch (error) {
                    setResult({ error: \`Connection error: \${error.message}\` });
                } finally {
                    setAnalyzing(false);
                }
            };
            
            return React.createElement('div', { className: 'max-w-4xl mx-auto space-y-8' },
                React.createElement('div', { className: 'text-center' },
                    React.createElement('h1', { className: 'text-3xl font-bold text-gray-900 mb-4' }, 'Upload Legal Document'),
                    React.createElement('p', { className: 'text-gray-600' }, 'Upload your contract, agreement, or legal document for AI analysis')
                ),
                
                React.createElement('div', { className: 'bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center' },
                    React.createElement('input', {
                        type: 'file',
                        accept: '.pdf,.docx,.txt',
                        onChange: handleFileSelect,
                        className: 'mb-6 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer'
                    }),
                    
                    file && React.createElement('div', { className: 'mb-6 p-4 bg-gray-50 rounded-lg' },
                        React.createElement('p', { className: 'text-sm font-medium text-gray-700' }, \`Selected: \${file.name}\`),
                        React.createElement('p', { className: 'text-xs text-gray-500' }, \`Size: \${(file.size / 1024).toFixed(1)} KB\`)
                    ),
                    
                    React.createElement('button', {
                        onClick: handleAnalyze,
                        disabled: !file || analyzing,
                        className: 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-colors disabled:cursor-not-allowed'
                    }, analyzing ? 'Analyzing...' : 'Analyze Document'),
                    
                    React.createElement('div', { className: 'mt-4 text-sm text-gray-500 space-y-1' },
                        React.createElement('p', null, 'Supported formats: PDF, DOCX, TXT'),
                        React.createElement('p', null, \`Backend API: \${API_BASE}\`)
                    )
                ),
                
                result && React.createElement('div', { 
                    className: \`p-6 rounded-lg \${result.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}\`
                },
                    result.error 
                        ? React.createElement('div', null,
                            React.createElement('h3', { className: 'text-lg font-semibold text-red-800 mb-2' }, 'Error'),
                            React.createElement('p', { className: 'text-red-700' }, result.error)
                          )
                        : React.createElement('div', null,
                            React.createElement('h3', { className: 'text-lg font-semibold text-green-800 mb-4' }, 'Analysis Complete!'),
                            React.createElement('div', { className: 'bg-white p-4 rounded border' },
                                React.createElement('pre', { 
                                    className: 'text-sm text-gray-700 whitespace-pre-wrap'
                                }, JSON.stringify(result, null, 2))
                            )
                          )
                )
            );
        }
        
        function Admin() {
            const [status, setStatus] = useState('checking');
            const [adminData, setAdminData] = useState(null);
            
            useEffect(() => {
                checkAdminStatus();
            }, []);
            
            const checkAdminStatus = async () => {
                try {
                    const response = await fetch(\`\${API_BASE}/api/auth/session\`, {
                        credentials: 'include'
                    });
                    const data = await response.json();
                    
                    if (data.authenticated) {
                        setStatus('authenticated');
                        setAdminData(data.user);
                    } else {
                        setStatus('not-authenticated');
                    }
                } catch (error) {
                    setStatus('error');
                    console.error('Admin check failed:', error);
                }
            };
            
            return React.createElement('div', { className: 'max-w-4xl mx-auto space-y-8' },
                React.createElement('h1', { className: 'text-3xl font-bold text-gray-900' }, 'Admin Dashboard'),
                
                status === 'checking' && React.createElement('div', { className: 'text-center py-8' },
                    React.createElement('div', { className: 'spinner mx-auto mb-4' }),
                    React.createElement('p', { className: 'text-gray-600' }, 'Checking authentication...')
                ),
                
                status === 'authenticated' && React.createElement('div', { className: 'bg-green-50 border border-green-200 rounded-lg p-6' },
                    React.createElement('h2', { className: 'text-xl font-semibold text-green-800 mb-4' }, '✅ Admin Authenticated'),
                    React.createElement('div', { className: 'space-y-2 text-green-700' },
                        React.createElement('p', null, \`Welcome, \${adminData?.email || 'Admin'}\`),
                        React.createElement('p', null, 'Development auto-login is active.'),
                        React.createElement('p', { className: 'text-sm' }, \`Backend: \${API_BASE}\`)
                    ),
                    React.createElement('div', { className: 'mt-6 grid md:grid-cols-2 gap-4' },
                        React.createElement('div', { className: 'bg-white p-4 rounded border' },
                            React.createElement('h3', { className: 'font-semibold mb-2' }, 'System Status'),
                            React.createElement('p', { className: 'text-sm text-gray-600' }, 'Backend: ✅ Connected'),
                            React.createElement('p', { className: 'text-sm text-gray-600' }, 'Database: ✅ Connected'),
                            React.createElement('p', { className: 'text-sm text-gray-600' }, 'Auth: ✅ Active')
                        ),
                        React.createElement('div', { className: 'bg-white p-4 rounded border' },
                            React.createElement('h3', { className: 'font-semibold mb-2' }, 'Quick Actions'),
                            React.createElement('div', { className: 'space-y-2' },
                                React.createElement('button', { 
                                    className: 'block w-full text-left text-blue-600 hover:text-blue-800 text-sm'
                                }, 'View System Logs'),
                                React.createElement('button', { 
                                    className: 'block w-full text-left text-blue-600 hover:text-blue-800 text-sm'
                                }, 'Manage Users'),
                                React.createElement('button', { 
                                    className: 'block w-full text-left text-blue-600 hover:text-blue-800 text-sm'
                                }, 'System Settings')
                            )
                        )
                    )
                ),
                
                status === 'not-authenticated' && React.createElement('div', { className: 'bg-yellow-50 border border-yellow-200 rounded-lg p-6' },
                    React.createElement('h2', { className: 'text-xl font-semibold text-yellow-800 mb-4' }, '⚠️ Authentication Required'),
                    React.createElement('p', { className: 'text-yellow-700 mb-4' }, 'Admin access requires authentication. In development mode, auto-login should be active.'),
                    React.createElement('button', {
                        onClick: checkAdminStatus,
                        className: 'bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded'
                    }, 'Retry Authentication')
                ),
                
                status === 'error' && React.createElement('div', { className: 'bg-red-50 border border-red-200 rounded-lg p-6' },
                    React.createElement('h2', { className: 'text-xl font-semibold text-red-800 mb-4' }, '❌ Connection Error'),
                    React.createElement('p', { className: 'text-red-700 mb-4' }, 'Cannot connect to backend. Make sure the server is running on port 3001.'),
                    React.createElement('button', {
                        onClick: checkAdminStatus,
                        className: 'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded'
                    }, 'Retry Connection')
                )
            );
        }
        
        function Subscription() {
            const plans = [
                { name: 'Free', price: '$0', period: 'forever', features: ['10 documents/month', 'Basic analysis', 'Email support'], popular: false },
                { name: 'Professional', price: '$29', period: 'month', features: ['Unlimited documents', 'Advanced analysis', 'Priority support', 'PDF exports'], popular: true },
                { name: 'Enterprise', price: '$99', period: 'month', features: ['Everything in Pro', 'Custom integrations', 'Dedicated support', 'SLA guarantees'], popular: false }
            ];
            
            return React.createElement('div', { className: 'max-w-6xl mx-auto space-y-12' },
                React.createElement('div', { className: 'text-center space-y-4' },
                    React.createElement('h1', { className: 'text-4xl font-bold text-gray-900' }, 'Choose Your Plan'),
                    React.createElement('p', { className: 'text-xl text-gray-600' }, 'Select the perfect plan for your legal document analysis needs')
                ),
                
                React.createElement('div', { className: 'grid md:grid-cols-3 gap-8' },
                    plans.map((plan, i) =>
                        React.createElement('div', {
                            key: i,
                            className: \`relative bg-white border-2 rounded-lg p-8 \${plan.popular ? 'border-blue-500 shadow-lg' : 'border-gray-200'}\`
                        },
                            plan.popular && React.createElement('div', {
                                className: 'absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold'
                            }, 'Most Popular'),
                            
                            React.createElement('div', { className: 'text-center mb-8' },
                                React.createElement('h3', { className: 'text-2xl font-bold text-gray-900 mb-2' }, plan.name),
                                React.createElement('div', { className: 'mb-4' },
                                    React.createElement('span', { className: 'text-4xl font-bold text-gray-900' }, plan.price),
                                    React.createElement('span', { className: 'text-gray-600' }, \`/\${plan.period}\`)
                                )
                            ),
                            
                            React.createElement('ul', { className: 'space-y-4 mb-8' },
                                plan.features.map((feature, j) =>
                                    React.createElement('li', { 
                                        key: j, 
                                        className: 'flex items-center text-gray-700'
                                    },
                                        React.createElement('span', { className: 'text-green-500 mr-3' }, '✓'),
                                        feature
                                    )
                                )
                            ),
                            
                            React.createElement('button', {
                                className: \`w-full py-3 px-4 rounded-lg font-semibold transition-colors \${
                                    plan.popular 
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                                }\`
                            }, plan.name === 'Free' ? 'Get Started' : 'Choose Plan')
                        )
                    )
                )
            );
        }
        
        function Privacy() {
            return React.createElement('div', { className: 'max-w-4xl mx-auto prose prose-lg' },
                React.createElement('h1', null, 'Privacy Policy'),
                React.createElement('p', null, 'Your privacy is our top priority. This document explains how we handle your information.'),
                React.createElement('h2', null, 'Information We Collect'),
                React.createElement('p', null, 'We only collect information necessary to provide our document analysis service.'),
                React.createElement('h2', null, 'How We Use Your Information'),
                React.createElement('p', null, 'Your documents are processed securely and never stored permanently.')
            );
        }
        
        function Terms() {
            return React.createElement('div', { className: 'max-w-4xl mx-auto prose prose-lg' },
                React.createElement('h1', null, 'Terms of Service'),
                React.createElement('p', null, 'By using ReadMyFinePrint, you agree to these terms of service.'),
                React.createElement('h2', null, 'Service Description'),
                React.createElement('p', null, 'ReadMyFinePrint provides AI-powered legal document analysis.')
            );
        }
        
        function NotFound() {
            return React.createElement('div', { className: 'text-center space-y-6' },
                React.createElement('div', { className: 'text-8xl' }, '🔍'),
                React.createElement('h1', { className: 'text-4xl font-bold text-gray-900' }, '404 - Page Not Found'),
                React.createElement('p', { className: 'text-gray-600 text-lg' }, "The page you're looking for doesn't exist."),
                React.createElement(Link, {
                    to: '/',
                    className: 'inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors'
                }, 'Return Home')
            );
        }
        
        function Footer() {
            return React.createElement('footer', { className: 'bg-white border-t mt-16' },
                React.createElement('div', { className: 'container mx-auto px-4 py-8' },
                    React.createElement('div', { className: 'text-center space-y-4' },
                        React.createElement('div', { className: 'flex justify-center space-x-6' },
                            React.createElement(Link, { to: '/privacy', className: 'text-gray-600 hover:text-blue-600' }, 'Privacy'),
                            React.createElement(Link, { to: '/terms', className: 'text-gray-600 hover:text-blue-600' }, 'Terms'),
                            React.createElement(Link, { to: '/admin', className: 'text-gray-600 hover:text-blue-600' }, 'Admin')
                        ),
                        React.createElement('p', { className: 'text-gray-600' }, '© 2025 ReadMyFinePrint. Privacy-first legal document analysis.'),
                        React.createElement('p', { className: 'text-sm text-gray-500' },
                            \`Frontend: http://localhost:\${window.location.port} | Backend: \${API_BASE}\`
                        )
                    )
                )
            );
        }
        
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(App));
    </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Serve static files from client/public
  if (pathname !== '/') {
    const filePath = path.join(__dirname, 'client', 'public', pathname);
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      
      res.writeHead(200, { 'Content-Type': mimeType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }
  
  // Serve React app for all routes (SPA routing)
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(appHtml);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Development server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Serving React SPA with full routing and pages`);
  console.log(`🔗 Backend API: http://localhost:3001`);
  console.log(`✨ Pages: Home, Upload, Admin, Subscription, Privacy, Terms, 404`);
  console.log(`🎯 Ready for development!`);
});