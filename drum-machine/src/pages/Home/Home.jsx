import { useState } from 'react'
import './home.css'
import ShapeStack from '../ShapeStack/ShapeStack.jsx'

function Home() {
  return (
    <div className="home-container">
        <div className="site-title">charliedahle.me</div>
        <ShapeStack /> 
    </div>
  );
}

export default Home