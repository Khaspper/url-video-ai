import axios from "axios";
import { FormEvent, useState } from "react";

function App() {
  const [url, setUrl] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setLoadingMessage('Generating assets...');

    try {
      // Step 1: Generate assets and get the id
      const assetsResponse = await axios.get(
        'http://localhost:8080/create-story?url=' + encodeURIComponent(url)
      );
      // Ensure `id` is extracted explicitly
      const id = assetsResponse.data.id || assetsResponse.data;

      if (!id) {
        throw new Error('Failed to retrieve ID from assetsResponse');
      }

      // Step 2: Prepare the video using the id
      setLoadingMessage('Preparing your video...');
      const videoResponse = await axios.get(
        'http://localhost:8080/build-video?id=' + encodeURIComponent(id)
      );

      // Step 3: Redirect to the generated video
      setLoadingMessage('');
      window.location.href = 'http://localhost:8080/' + videoResponse.data;
    } catch (error) {
      console.error('Error:', error);
      setLoadingMessage('An error occurred. Please try again.');
    }
  }

  return (
    <>
      {loadingMessage && (
        <div className="fixed inset-0 bg-black/90 flex justify-center items-center">
          <p className="text-4xl text-center">{loadingMessage}</p>
        </div>
      )}
      <main className="max-w-2xl mx-auto flex px-3 gap-8">
        {/* Left side */}
        <div className="py-8 flex flex-col justify-center">
          <h1 className="text-4xl font-bold uppercase mb-4">
            <span className="text-5xl">URL to video</span>
            <br />
            <span className="bg-gradient-to-br from-purple-300 from-30% to-sky-500 bg-clip-text text-transparent">
              with power of AI
            </span>
          </h1>
          <form onSubmit={handleSubmit} className="grid gap-2">
            <input
              className="border-2 rounded-full bg-transparent text-white px-4 py-2 grow"
              value={url}
              onChange={(ev) => setUrl(ev.target.value)}
              type="url"
              placeholder="https://..."
            />
            <button
              className="bg-purple-500 text-white px-4 py-2 rounded-full uppercase"
              type="submit"
            >
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
  );
}

export default App;
