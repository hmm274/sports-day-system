import logo from './logo.svg';
import './App.css';
import Timer from './Timer';

function App() {
  return(
    <div className="App">
      <h1>Race Timer</h1>
      {[...Array(8)].map((_,index)=>(
        <Timer key={index} laneId={index+1} />
      ))}
    </div>
  )
}

export default App;
