import { useState } from 'react'
import './home.css'
import ShapeStack from './shapestack'

function Home() {
  return (
    <div className="home-container">
        <ShapeStack /> 
    </div>
  );
}

export default Home