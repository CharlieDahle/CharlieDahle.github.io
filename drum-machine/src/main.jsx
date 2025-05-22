import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx';
import Drums from './drums.jsx';
import Home from './home.jsx'
import AnimatedLayout from './AnimatedLayout.jsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

const router = createBrowserRouter([
  {path:'/', element: <AnimatedLayout key="app"><App/></AnimatedLayout>},
  {path:'/drums', element: <AnimatedLayout key="drums"><Drums/></AnimatedLayout>},
  {path:'/home', element: <AnimatedLayout key="home"><Home/></AnimatedLayout>}
]);

createRoot(document.getElementById('root')).render(
<StrictMode>
  <AnimatePresence mode="wait">
    <RouterProvider router={router}/>
  </AnimatePresence>
</StrictMode>,
)