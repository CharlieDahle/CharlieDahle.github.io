import './Music.css'

const SONGS = [
  { id: 'GkPyui6V9ro', title: 'pool pole yellow' },
  { id: 'qKrqbaSEDqk', title: 'i dont check the price' },
]

function Music() {
  return (
    <div className="music-root">
      <header className="music-header">
        <a href="https://charliedahle.me" className="music-back">
          ← charliedahle.me
        </a>
      </header>

      <main className="music-content">
        <h1 className="music-title">Music</h1>
        <div className="music-grid">
          {SONGS.map((song) => (
            <div key={song.id} className="song-card">
              <div className="song-embed-wrapper">
                <iframe
                  src={`https://www.youtube.com/embed/${song.id}`}
                  title={song.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="song-embed"
                />
              </div>
              <p className="song-title">{song.title}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default Music
