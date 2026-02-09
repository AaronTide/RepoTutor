
import React, { useState, useEffect } from 'react';
import { RepoInfo, FileNode, Tutorial, LearningMode } from './types';
import { fetchRepoInfo, fetchRepoTree, parseGithubUrl, fetchFileContent, resolveActualPath } from './services/githubService';
import { generateTutorial } from './services/geminiService';
import ChapterContent from './components/ChapterContent';
import FileExplorer from './components/FileExplorer';
import VoiceAssistant from './components/VoiceAssistant';
import { ICONS } from './constants';

interface FeaturedRepo {
  name: string;
  full_name: string;
  description: string;
  icon: string;
  bgColor: string;
  demoUrl?: string;
}

const FEATURED_REPOS: FeaturedRepo[] = [
  {
    name: 'React',
    full_name: 'facebook/react',
    description: 'A JavaScript library for building user interfaces.',
    icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/react/react.png',
    bgColor: '#66ccff',
    demoUrl: '/react_demo.json'
  },
  {
    name: 'VS Code',
    full_name: 'microsoft/vscode',
    description: 'Code editing. Redefined.',
    icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/visual-studio-code/visual-studio-code.png',
    bgColor: '#ff99cc'
  },
  {
    name: 'Express',
    full_name: 'expressjs/express',
    description: 'Fast, unopinionated, minimalist web framework for Node.js.',
    icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/express/express.png',
    bgColor: '#ffcc33'
  },
  {
    name: 'Flask',
    full_name: 'pallets/flask',
    description: 'The Python micro framework for building web applications.',
    icon: 'https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/flask/flask.png',
    bgColor: '#99ccbc'
  }
];

const App: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [learningMode, setLearningMode] = useState<LearningMode>('beginner');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [activeTab, setActiveTab] = useState<'tutorial' | 'trace' | 'code'>('tutorial');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorPath, setInspectorPath] = useState<string | null>(null);

  const startAnalysis = async (customUrl?: string, demoUrl?: string) => {
    if (demoUrl) {
      setLoading(true);
      setLoadingStatus('Loading pre-generated tutorial...');
      try {
        const response = await fetch(demoUrl);
        if (!response.ok) throw new Error('Demo file not found');
        const data = await response.json();
        setTutorial(data);
        setActiveChapterId(data.chapters[0].id);
        setRepoInfo({ owner: 'demo', repo: data.repoName, full_name: data.repoName, description: data.description, html_url: '', default_branch: 'main' });
        return;
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    const targetUrl = customUrl || repoUrl;
    const parsed = parseGithubUrl(targetUrl);
    if (!parsed) {
      alert('Please enter a valid GitHub repository URL');
      return;
    }

    setLoading(true);
    setLoadingStatus('Fetching repository data...');
    try {
      const info = await fetchRepoInfo(parsed.owner, parsed.repo);
      setRepoInfo(info);
      
      const tree = await fetchRepoTree(parsed.owner, parsed.repo, info.default_branch);
      setFileTree(tree);

      setLoadingStatus('Searching for documentation...');
      let readme = '';
      const readmePath = resolveActualPath('README.md', tree);
      if (readmePath) {
        try {
          readme = await fetchFileContent(parsed.owner, parsed.repo, readmePath, info.default_branch);
        } catch (e) { console.warn(e); }
      }

      setLoadingStatus('AI building mental model...');
      const summary = tree
        .filter(n => n.type === 'blob' && !n.path.includes('node_modules') && !n.path.includes('.git'))
        .slice(0, 150)
        .map(n => n.path)
        .join('\n');

      const result = await generateTutorial(info.full_name, summary, readme || 'No README', learningMode);
      setTutorial(result);
      setActiveChapterId(result.chapters[0].id);
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message || 'Failed to analyze repository.'}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = () => {
    if (!tutorial) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tutorial, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${tutorial.repoName.replace('/', '_')}_tutorial.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const currentChapter = tutorial?.chapters.find(c => c.id === activeChapterId);

  const openInspector = (path: string) => {
    setInspectorPath(path);
    setShowInspector(true);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#f3f2e7] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 mb-8 bg-black border-[4px] border-black shadow-[8px_8px_0px_0px_#ffcc33] flex items-center justify-center font-black text-4xl text-white">AI</div>
        <h2 className="text-4xl font-black text-black mb-4 tracking-tighter uppercase italic">Deconstructing Codebase...</h2>
        <div className="flex items-center gap-3 text-black font-mono font-bold bg-[#ffcc33] px-6 py-3 border-[3px] border-black shadow-[4px_4px_0px_0px_#000]">
          {loadingStatus}
        </div>
      </div>
    );
  }

  if (!tutorial) {
    return (
      <div className="min-h-screen bg-[#f3f2e7] flex flex-col items-center">
        <main className="w-full max-w-6xl p-12">
          <header className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-black text-white flex items-center justify-center font-black text-xl border-[2px] border-black shadow-[3px_3px_0px_0px_#ffcc33]">R</div>
              <span className="text-2xl font-black tracking-tighter uppercase italic">RepoTutor</span>
            </div>
            <div className="w-10 h-10 border-[3px] border-black bg-[#ffcc33] overflow-hidden shadow-[3px_3px_0px_0px_#000]">
              <img src="https://api.dicebear.com/7.x/pixel-art/svg" alt="avatar" />
            </div>
          </header>

          <section className="mb-20">
            <h1 className="text-8xl font-black mb-4 uppercase italic tracking-tighter leading-none text-center lg:text-left">Learn Fast.</h1>
            <p className="text-2xl font-bold text-black/60 mb-12 max-w-2xl text-center lg:text-left">
              Turn any GitHub repo into a structured visual masterclass instantly.
            </p>

            <div className="brutal-card bg-[#ffcc33] p-10 flex flex-col lg:flex-row gap-10">
               <div className="w-full lg:w-64 h-80 border-[4px] border-black shadow-[8px_8px_0px_0px_#000] overflow-hidden bg-white shrink-0">
                  <img src="https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&q=80&w=500" className="w-full h-full object-cover" alt="hero"/>
               </div>
               <div className="flex-1 flex flex-col justify-center">
                  <div className="flex gap-2 mb-8">
                    {['beginner', 'advanced'].map(m => (
                      <button key={m} onClick={() => setLearningMode(m as LearningMode)} className={`px-6 py-2 border-[3px] border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000] ${learningMode === m ? 'bg-black text-white' : 'bg-white text-black'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                  <h2 className="text-5xl font-black uppercase mb-2 italic tracking-tighter">Enter a GitHub URL</h2>
                  <div className="flex border-[3px] border-black bg-white shadow-[6px_6px_0px_0px_#000] mb-4">
                     <div className="px-4 flex items-center text-black/40"><ICONS.Search className="w-5 h-5"/></div>
                     <input 
                        type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && startAnalysis()}
                        placeholder="e.g. facebook/react"
                        className="w-full py-4 bg-white focus:outline-none font-bold"
                      />
                      <button onClick={() => startAnalysis()} className="bg-black text-white px-8 font-black uppercase italic border-l-[3px] border-black hover:bg-white hover:text-black">Launch</button>
                  </div>
               </div>
            </div>
          </section>

          <section className="mb-20">
            <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-8">Featured Tutorials</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {FEATURED_REPOS.map((repo) => (
                <button
                  key={repo.full_name}
                  onClick={() => startAnalysis(`https://github.com/${repo.full_name}`, repo.demoUrl)}
                  className="text-left brutal-card p-6 flex flex-col gap-4"
                  style={{ backgroundColor: repo.bgColor }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white border-[3px] border-black flex items-center justify-center p-2 shadow-[3px_3px_0px_0px_#000]">
                      <img src={repo.icon} alt={repo.name} className="w-full h-full object-contain" />
                    </div>
                    <h4 className="font-black text-lg uppercase tracking-tighter leading-none">{repo.name}</h4>
                  </div>
                  <p className="font-bold text-xs italic leading-tight">{repo.description}</p>
                  <span className="font-black text-[10px] uppercase bg-black text-white px-3 py-1 self-start">{repo.demoUrl ? 'Demo Mode' : 'View'}</span>
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f3f2e7] overflow-hidden font-sans">
      <aside className="w-72 bg-[#99ccbc] border-r-[4px] border-black flex flex-col shrink-0 overflow-y-auto no-scrollbar">
        <div className="p-6 border-b-[4px] border-black flex items-center gap-3 bg-white">
          <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-black text-lg border-[2px] border-black">R</div>
          <h2 className="text-black font-black text-lg truncate uppercase tracking-tighter">{repoInfo?.repo}</h2>
        </div>
        
        <div className="p-6 flex flex-col gap-2 flex-1">
          <div className="text-[10px] font-black text-black uppercase tracking-widest mb-2 opacity-40">The Syllabus</div>
          {tutorial.chapters.map((chapter, i) => (
            <button key={chapter.id} onClick={() => { setActiveChapterId(chapter.id); setActiveTab('tutorial'); }}
              className={`w-full text-left px-4 py-3 border-[3px] border-black transition-all flex items-start gap-3 ${activeChapterId === chapter.id ? 'bg-black text-white shadow-[4px_4px_0px_0px_#ffcc33] -translate-y-1' : 'bg-white text-black'}`}>
              <span className="font-black text-xs mt-1">{i + 1}.</span>
              <div className="font-black text-sm uppercase italic leading-none">{chapter.title}</div>
            </button>
          ))}
        </div> 

        <div className="p-6 bg-white border-t-[4px] border-black space-y-3">
           <button onClick={downloadJson} className="w-full bg-[#66ccff] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] py-3 font-black uppercase italic text-xs">Export JSON</button>
           <button onClick={() => setTutorial(null)} className="w-full brutal-btn bg-white py-3 font-black uppercase italic text-xs">New Repo</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[#f3f2e7] relative">
        <div className="sticky top-0 z-10 bg-white border-b-[4px] border-black px-8 py-4 flex justify-between items-center shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]">
           <div className="flex items-center gap-2 text-sm font-black uppercase italic tracking-tighter">
              <span>RepoTutor</span> <span className="opacity-20">/</span> <span className="text-[#ff99cc]">{activeTab}</span>
           </div>
           <div className={`px-4 py-1 border-[3px] border-black text-[10px] font-black uppercase italic ${learningMode === 'beginner' ? 'bg-green-300' : 'bg-purple-300'}`}>
             {learningMode} mode
           </div>
        </div>

        <div className="p-8">
          {activeTab === 'tutorial' && currentChapter && (
            <ChapterContent 
              chapter={currentChapter} 
              onFileClick={openInspector} 
              fileTree={fileTree} 
            />
          )}
        </div>

        <VoiceAssistant context={`Learning ${repoInfo?.full_name}. Architecture: ${tutorial.highLevelArchitecture}`} />
      </main>

      {showInspector && (
        <FileExplorer tree={fileTree} repoInfo={repoInfo!} mode={learningMode} onClose={() => { setShowInspector(false); setInspectorPath(null); }} initialPath={inspectorPath} />
      )}
    </div>
  );
};

export default App;
