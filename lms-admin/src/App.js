import React, { Component } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import store from './redux/store';
import MainApp from './container/MainApp';
import './assets/css/custom.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default class App extends Component {
  render() {
    return (
      <Provider store={store}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#0A3150',
              borderRadius: 2,
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            },
            components: {
              Switch: {
                colorPrimary: '#00b96b',
              },
              Layout: {
                siderBg: '#0A3150',
                triggerBg: '#07243b',
              },
              Menu: {
                darkItemBg: '#0A3150',
                darkSubMenuItemBg: '#07243b',
                darkItemSelectedBg: '#164e7a',
              },
            },
          }}
        >
          <BrowserRouter>
            <QueryClientProvider client={queryClient}>
              <MainApp />
            </QueryClientProvider>
          </BrowserRouter>
        </ConfigProvider>
      </Provider>
    );
  }
}
