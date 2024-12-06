
function App() {

  return (
    <>
      <main className="max-w-2xl mx-auto flex px-3 gap-8">
        {/* Left side */}
        <div className="py-8 flex flex-col justify-center">
          <h1 className="text-4xl font-bold uppercase mb-4">
            <span className="text-5xl">
              URL to video
            </span>
            <br />
            <span className="bg-gradient-to-br from-purple-300 from-30% to-sky-500 bg-clip-text text-transparent">
              with power of AI
            </span>
          </h1>
          <form className="grid gap-2">
            <input 
              className="border-2 rounded-full bg-transparent text-white px-4 py-2 grow"
              type="url" placeholder="https://..."/>
            <button
              className="bg-purple-500 text-white px-4 py-2 rounded-full uppercase" 
              type="submit">
              Create&nbsp;video
            </button>
          </form>
        </div>
        {/* Right side */}
        <div className="py-4">
          <div className="bg-gray-200 w-[240px] h-[380px] text-gray-500 rounded-2xl p-8">
            Video Here
          </div>
        </div>
      </main>
      
    </>
  )
}

export default App
