import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
    mutations: { retry: 0 }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              borderRadius: '12px',
              fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              background: '#FFFFFF',
              color: '#1E293B',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -12px rgba(15,23,42,0.18)',
              padding: '10px 14px',
            },
            success: { iconTheme: { primary: '#6339E0', secondary: '#FFFFFF' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#FFFFFF' } },
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
