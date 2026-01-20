// App.jsx
import { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { WebOSInputProvider } from './services/navigation/WebOSInputProvider'
import { FocusProvider } from './services/navigation/focusManager'
import { FocusableItem } from './components/FocusableItem'
import './style.css'
import { EdgeScrollTriggers } from './components/EdgeScrollTriggers'

function App() {
  const rows = Array.from({ length: 15 }, (_, rowIndex) => ({
    id: rowIndex,
    title: [
      'Trending Now',
      'Popular on WebOS',
      'Top Picks for You',
      'New Releases',
      'Action & Adventure',
      'Comedies',
      'Documentaries',
      'Thrillers',
      'Drama Series',
      'Sci-Fi & Fantasy',
      'Horror Movies',
      'Family Entertainment',
      'Critically Acclaimed',
      'Watch It Again',
      'Hidden Gems'
    ][rowIndex] || `Category ${rowIndex + 1}`,
    items: Array.from({ length: 8 }, (_, itemIndex) => ({
      id: `${rowIndex}-${itemIndex}`,
      image: `https://placehold.co/300x400/1a1a1a/white?text=Item+${itemIndex + 1}`,
      title: `Title ${itemIndex + 1}`
    }))
  }))

  return (
    <WebOSInputProvider>
      <FocusProvider>
        <EdgeScrollTriggers />
        <div className="app">
          <header className="header">
            <h1>Plex</h1>
            <nav>
              <a href="#">Home</a>
              <a href="#">Movies</a>
              <a href="#">Series</a>
              <a href="#">My Library</a>
            </nav>
          </header>

          <div className="hero">
            <img
              src="https://placehold.co/1920x800/2a2a2a/white?text=Featured+Content"
              alt="Hero"
              className="hero-image"
            />
            <div className="hero-content">
              <h2>Featured Content</h2>
              <p>Discover amazing content on your Plex server</p>
              <div className="hero-buttons">
                <button className="btn-play">▶ Play</button>
                <button className="btn-info">ⓘ More Info</button>
              </div>
            </div>
          </div>

          <div className="content">
            {rows.map(row => (
              <div key={row.id} className="row">
                <h2 className="row-title">{row.title}</h2>
                <div className="row-items">
                  {row.items.map((item, colIndex) => (
                    <FocusableItem
                      key={item.id}
                      id={item.id}
                      rowIndex={row.id}
                      colIndex={colIndex}
                      onClick={() => ('Clicked:', item.title)}
                      className="item"
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        loading="lazy"
                      />
                      <div className="item-overlay">
                        <h3>{item.id}</h3>
                      </div>
                    </FocusableItem>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </FocusProvider>
    </WebOSInputProvider>
  )
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />)