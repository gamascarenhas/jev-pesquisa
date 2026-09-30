import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { Providers } from './providers';
import { rotas } from './routes';

export function App() {
  const [roteador] = useState(() => createBrowserRouter(rotas));
  return (
    <Providers>
      <RouterProvider router={roteador} />
    </Providers>
  );
}
