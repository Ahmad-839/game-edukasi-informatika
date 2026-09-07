import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import { QrCode, User, Play, Download, Settings, X, Check, FileText, Pickaxe } from 'lucide-react';

// Menggunakan variabel global dari environment
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'informatika-fase-e-game';

// Map diperbesar untuk pengalaman eksplorasi
const MAP_WIDTH = 40;
const MAP_HEIGHT = 40;
const TILE_SIZE = 48; // Diperbesar sedikit agar mudah di-tap di mobile
const CHARACTERS = ['🧙‍♂️', '🥷', '🕵️‍♀️', '🦸‍♂️', '🧟‍♂️', '🤖'];

const QUESTIONS = [
  // 1. Pilihan Ganda
  { id: 'q1', x: 5, y: 5, type: 'PG', points: 4, text: 'Di Rumah Sakit "Sehat Sentosa", pasien yang mendaftar lebih awal akan dipanggil dan dilayani terlebih dahulu oleh dokter. Konsep urutan pelayanan pasien ini paling sesuai direpresentasikan dengan struktur data apa?', options: ['Array', 'Stack', 'Queue', 'Tree', 'Graph'], answer: 2 }, // Index 2 = Queue
  { id: 'q2', x: 12, y: 15, type: 'PG', points: 4, text: 'Saat kamu mengetik dokumen dan melakukan kesalahan, kamu menekan tombol "Undo" (Ctrl+Z) sehingga sistem membatalkan ketikan yang paling akhir kamu masukkan. Prinsip kerja membatalkan aksi terakhir ini identik dengan prinsip kerja struktur data...', options: ['FIFO (First In First Out)', 'LIFO (Last In First Out) / Stack', 'Random Access / Array', 'Hierarchical / Tree', 'Network / Graph'], answer: 1 }, // LIFO
  
  // 2. Pilihan Ganda Kompleks
  { id: 'q6', x: 25, y: 8, type: 'PG_KOMPLEKS', points: 5, text: 'Budi sedang memperhatikan tumpukan piring bersih di kafetaria. Piring terakhir yang ditaruh akan diletakkan di paling atas dan akan diambil paling pertama. Konsep ini mirip dengan struktur data Stack. Dari pernyataan di bawah ini, manakah karakteristik yang BENAR mengenai Stack? (Pilih lebih dari satu)', options: ['Menggunakan prinsip LIFO (Last In First Out)', 'Data yang pertama masuk akan keluar paling pertama', 'Operasi untuk memasukkan data disebut "Push"', 'Operasi untuk mengeluarkan data disebut "Dequeue"', 'Sangat cocok untuk menyimpan fitur riwayat (history) pada peramban web'], answers: [0, 2, 4] },
  { id: 'q7', x: 30, y: 22, type: 'PG_KOMPLEKS', points: 5, text: 'Array adalah struktur data yang sering digunakan untuk menyimpan daftar data yang berurutan. Manakah dari pernyataan berikut yang merupakan sifat yang BENAR mengenai struktur data Array? (Pilih semua jawaban tepat)', options: ['Ukurannya biasanya tetap (statis) setelah dideklarasikan di awal', 'Setiap elemen datanya diakses secara langsung menggunakan sebuah indeks', 'Secara bawaan bisa langsung menyimpan tipe data yang berbeda-beda (campuran)', 'Kecepatan akses untuk membaca data ke-N sangat cepat (seketika)', 'Otomatis mengecil jika data di dalamnya dihapus agar hemat memori'], answers: [0, 1, 3] },

  // 3. Benar / Salah
  { id: 'q11', x: 8, y: 30, type: 'BS', points: 4, text: 'Perhatikan kasus berikut: Di sebuah minimarket, pembeli harus mengantre di kasir. Pembeli yang datang ke kasir paling awal akan menyelesaikan pembayaran paling awal. Kasus ini merupakan penerapan langsung dari prinsip struktur data Queue (FIFO).', answer: true },
  { id: 'q12', x: 35, y: 35, type: 'BS', points: 4, text: 'Dalam sebuah simulasi antrean bank yang murni menggunakan konsep Queue, nasabah yang datang di urutan ke-10 akan dipanggil dan dilayani lebih dulu dibandingkan nasabah yang datang di urutan ke-2.', answer: false },

  // 4. Menjodohkan
  { id: 'q16', x: 18, y: 18, type: 'MATCHING', points: 10, text: 'Pasangkan nama struktur data atau istilah algoritma di sebelah kiri dengan ilustrasi dunia nyata / pengertian yang paling tepat di sebelah kanan!', 
    items: ['Array', 'Stack', 'Queue', 'Pencarian Sekuensial', 'Pseudocode'], 
    options: ['A. Antrean kendaraan di pintu gerbang tol (FIFO)', 'B. Teks ringkas yang mirip bahasa manusia untuk merancang algoritma', 'C. Deretan loker penitipan barang yang memiliki nomor urut', 'D. Mencari sebuah buku dari ujung kiri rak ke kanan dengan mengecek satu per satu', 'E. Tumpukan baju di dalam kardus sempit (LIFO)'],
    answers: [2, 4, 0, 3, 1] 
  },

  // 5. Esai
  { id: 'q21', x: 20, y: 5, type: 'ESAI', points: 10, text: 'Andi bingung harus memilih antara menggunakan "Array" atau "Linked List" untuk menyimpan data pendaftaran anggota eskul. Ia tahu bahwa jumlah pendaftar bisa bertambah terus-menerus tanpa batas maksimum yang jelas. Berikan saran kepada Andi, struktur data mana yang sebaiknya dipilih, lalu jelaskan alasannya dengan membandingkan perbedaan Array dan Linked List dari segi "ukuran/kapasitas" dan "cara penyimpanannya di memori"!', keyword: ['ukuran', 'tetap', 'dinamis', 'memori', 'berurutan', 'menyebar', 'pointer', 'referensi', 'linked list'] }
];

// Kumpulan soal ekstra untuk mengisi sisa peti di map (menghindari duplikasi pertanyaan yang sama persis)
const EXTRA_QUESTIONS_POOL = [
    { type: 'PG', points: 4, text: "Dalam pilar berpikir komputasional, proses memecah masalah besar yang rumit menjadi bagian-bagian kecil agar lebih mudah diselesaikan disebut...", options: ["Dekomposisi", "Abstraksi", "Pengenalan Pola", "Desain Algoritma", "Debugging"], answer: 0 },
    { type: 'PG', points: 4, text: "Saat membuat program simulasi lalu lintas, Rina mengabaikan warna dan merek mobil, lalu hanya berfokus pada kecepatan dan koordinat posisinya saja. Teknik berpikir komputasional apa yang sedang diterapkan Rina?", options: ["Dekomposisi", "Abstraksi", "Pengenalan Pola", "Pemrograman", "Evaluasi"], answer: 1 },
    { type: 'PG', points: 4, text: "Apa fungsi utama dari menyusun sebuah Algoritma sebelum kita mulai menulis kode program?", options: ["Membuat tampilan UI aplikasi lebih indah", "Merencanakan penyelesaian masalah melalui langkah-langkah yang logis dan terurut", "Mengamankan data aplikasi dari serangan peretas", "Membuat komputer bekerja melampaui batas kecepatan prosesornya", "Mengurangi jumlah memori yang digunakan oleh sistem operasi"], answer: 1 },
    { type: 'PG', points: 4, text: "Struktur data hierarkis yang memiliki titik awal (root/akar) dan cabang-cabang yang menghubungkan titik lainnya menyerupai struktur silsilah keluarga, dinamakan struktur data...", options: ["Array", "Linked List", "Stack", "Tree", "Graph"], answer: 3 },
    { type: 'PG', points: 4, text: "Rute penerbangan antar kota saling terhubung dan membentuk sebuah jaringan yang sangat kompleks di peta. Struktur data yang paling cocok untuk memodelkan jaringan antar titik seperti ini adalah...", options: ["Stack", "Queue", "Tree", "Graph", "Array"], answer: 3 }
];

// Sebarkan sisa peti harta karun secara acak untuk melengkapi 23 soal
const generateRemainingChests = () => {
    let currentChests = [...QUESTIONS];
    for (let i = currentChests.length + 1; i <= 23; i++) {
        let x, y;
        let isOccupied = true;
        while (isOccupied) {
            x = Math.floor(Math.random() * (MAP_WIDTH - 4)) + 2;
            y = Math.floor(Math.random() * (MAP_HEIGHT - 4)) + 2;
            isOccupied = currentChests.some(c => c.x === x && c.y === y);
        }
        
        // Ambil soal secara bergiliran dari pool pertanyaan ekstra
        const poolItem = EXTRA_QUESTIONS_POOL[(i - currentChests.length - 1) % EXTRA_QUESTIONS_POOL.length];
        
        currentChests.push({
            id: `q${i}`, x, y, 
            type: poolItem.type, 
            points: poolItem.points, 
            text: `Petunjuk Misteri #${i}: ${poolItem.text}`, 
            options: poolItem.options, 
            answer: poolItem.answer
        });
    }
    return currentChests;
}
const ALL_CHESTS = generateRemainingChests();

// Generate titik galian (X marks) yang terdiri dari peti asli dan titik zonk (kosong)
const generateDigSites = () => {
    let sites = [];

    // Masukkan semua peti harta karun
    ALL_CHESTS.forEach(chest => {
        sites.push({ id: `site_${chest.x}_${chest.y}`, x: chest.x, y: chest.y, type: 'chest', chestId: chest.id });
    });

    // Tambahkan 35 titik zonk (palsu) agar map lebih menantang
    for (let i = 0; i < 35; i++) {
        let x, y;
        let isOccupied = true;
        while (isOccupied) {
            x = Math.floor(Math.random() * (MAP_WIDTH - 4)) + 2;
            y = Math.floor(Math.random() * (MAP_HEIGHT - 4)) + 2;
            // Hindari tumpang tindih dengan galian lain dan area spawn awal (x < 6, y < 6)
            isOccupied = sites.some(s => s.x === x && s.y === y) || (x < 6 && y < 6); 
        }
        sites.push({ id: `site_${x}_${y}`, x, y, type: 'zonk' });
    }
    return sites;
}
const DIG_SITES = generateDigSites();

// 1. Generate Terrain Map (Batas Air dan Daratan Rumput)
const generateTerrain = () => {
    const grid = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            // Membuat efek tepian pantai/pulau (air di luar batas)
            let isWater = x < 2 || x > MAP_WIDTH - 3 || y < 2 || y > MAP_HEIGHT - 3;
            // Menambahkan sedikit keacakan agar garis pantai tidak kaku
            if ((x === 2 || x === MAP_WIDTH - 3 || y === 2 || y === MAP_HEIGHT - 3) && Math.random() > 0.5) {
                isWater = true; 
            }
            grid.push({ x, y, type: isWater ? 'water' : 'grass' });
        }
    }
    return grid;
}
const TERRAIN = generateTerrain();

// Generate dekorasi lingkungan yang lebih variatif (Pohon, Batu rintangan & Bunga hiasan)
const generateEnvironment = () => {
    const env = [];
    for (let i = 0; i < 350; i++) { // Jumlah objek diperbanyak
        const x = Math.floor(Math.random() * MAP_WIDTH);
        const y = Math.floor(Math.random() * MAP_HEIGHT);
        
        // Jangan taruh di air, area spawn, atau di atas titik galian (X)
        const isWater = TERRAIN.find(t => t.x === x && t.y === y)?.type === 'water';
        if (isWater || (x < 6 && y < 6) || DIG_SITES.some(s => s.x === x && s.y === y)) continue;
        
        const rand = Math.random();
        let type, isObstacle;
        
        // Membedakan hiasan (bunga) yang bisa diinjak vs penghalang (pohon/batu)
        if (rand < 0.6) {
            type = ['🌼', '🌸', '💮', '🌱'][Math.floor(Math.random() * 4)];
            isObstacle = false; 
        } else {
            type = ['🌳', '🌲', '🪨', '🪵'][Math.floor(Math.random() * 4)];
            isObstacle = true; 
        }
        
        env.push({ x, y, type, isObstacle });
    }
    return env;
}
const ENVIRONMENT = generateEnvironment();


export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); 
  const [playerData, setPlayerData] = useState(null);
  const [players, setPlayers] = useState({});
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [scoreNotification, setScoreNotification] = useState(null);
  const [digMessage, setDigMessage] = useState(null);
  
  // Ref untuk handle continuous movement di mobile
  const moveInterval = useRef(null);

  // Kumpulan notifikasi Zonk lucu ala Gen-Z
  const ZONK_MESSAGES = [
    "Capek-capek gali, eh isinya harapan palsu 💔",
    "Kosong wir! Kek dompet akhir bulan 💸",
    "Awokawokawok zonk! Cuma nemu fosil cicak 🦎",
    "Kasian deh lo, zonk! Mending ngopi dulu ngab ☕",
    "Yhaa elah, zonk brok! Cuma dapet cacing ngenes 🪱",
    "Zonk ges! Info loker gali harta karun dong 💀",
    "Gali terus bang sampe inti bumi! 🌍 (Zonk)",
    "Yahahaha wahyuuu... Zonk bosku! 🤣",
    "Plot twist: Emang gada apa-apa di sini 🗿",
    "Yahh ilah, skill issue bang? Coba gali di tempat lain 🏃‍♂️💨"
  ];

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const playersRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
    const unsubscribe = onSnapshot(playersRef, (snapshot) => {
      const playersData = {};
      snapshot.forEach((doc) => {
        playersData[doc.id] = doc.data();
      });
      setPlayers(playersData);
      
      if (playersData[user.uid]) {
          setPlayerData(playersData[user.uid]);
      }
    }, (error) => {
      console.error("Error fetching players:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleJoin = async (name, character) => {
    if (!user || !name.trim()) return;
    const newPlayer = {
      uid: user.uid,
      name: name,
      character: character,
      x: Math.floor(Math.random() * 3) + 2, // Spawn point lebih ke tengah rumput
      y: Math.floor(Math.random() * 3) + 2,
      score: 0,
      answeredChests: [],
      dugSites: [],
      lastMove: Date.now()
    };
    
    try {
        const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid);
        await setDoc(playerRef, newPlayer);
        setView('game');
    } catch (e) {
        console.error("Failed to join:", e);
    }
  };

  const movePlayer = useCallback(async (dx, dy) => {
    setPlayerData(prevData => {
        if (!prevData || view !== 'game' || activeQuestion) return prevData;

        let newX = prevData.x + dx;
        let newY = prevData.y + dy;

        // Boundaries
        if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return prevData;

        // Collision dengan Air
        const tile = TERRAIN.find(t => t.x === newX && t.y === newY);
        if (tile?.type === 'water') return prevData;

        // Collision dengan lingkungan (Hanya pohon dan batu yang menghalangi, bunga tidak)
        if (ENVIRONMENT.some(e => e.x === newX && e.y === newY && e.isObstacle)) return prevData;

        const now = Date.now();
        if (now - prevData.lastMove < 150) return prevData;

        // Update ke Firebase secara async
        const updateDb = async () => {
            try {
                const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid);
                await updateDoc(playerRef, { x: newX, y: newY, lastMove: now });
            } catch (e) { console.error("Move error:", e); }
        };
        updateDb();

        return { ...prevData, x: newX, y: newY, lastMove: now };
    });
  }, [view, activeQuestion, user]);

  const startMove = (dx, dy) => {
      if (moveInterval.current) clearInterval(moveInterval.current);
      movePlayer(dx, dy); // Bergerak sekali langsung
      moveInterval.current = setInterval(() => movePlayer(dx, dy), 180); // Ulangi setiap 180ms
  };
  const stopMove = () => {
      if (moveInterval.current) {
          clearInterval(moveInterval.current);
          moveInterval.current = null;
      }
  };

  const handleDig = async () => {
      if (!playerData || view !== 'game' || activeQuestion) return;

      const currentSite = DIG_SITES.find(s => s.x === playerData.x && s.y === playerData.y);
      const dugSites = playerData.dugSites || [];

      if (currentSite && !dugSites.includes(currentSite.id)) {
          // Proses gali
          const newDugSites = [...dugSites, currentSite.id];
          
          try {
              const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid);
              await updateDoc(playerRef, { dugSites: newDugSites });
          } catch (e) { console.error("Error digging:", e); }

          if (currentSite.type === 'zonk') {
              showDigMessage(ZONK_MESSAGES[Math.floor(Math.random() * ZONK_MESSAGES.length)]);
          } else if (currentSite.type === 'chest') {
              showDigMessage("Wah nemu peti harta! Langsung aja di-Buka ngab! 🎉");
          }
      } else {
          // Gali di tempat kosong atau yang sudah digali
          showDigMessage(ZONK_MESSAGES[Math.floor(Math.random() * ZONK_MESSAGES.length)]);
      }
  };

  const handleInteract = async (chestId) => {
      if (!playerData || view !== 'game' || activeQuestion) return;

      const chest = ALL_CHESTS.find(c => c.id === chestId);
      if (chest) {
          if (!(playerData.answeredChests || []).includes(chest.id)) {
              setActiveQuestion(chest); // Buka soal kuis
          } else {
              showDigMessage("Peti ini udah lo buka brok!");
          }
      }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch(e.key) {
        case 'ArrowUp': case 'w': movePlayer(0, -1); break;
        case 'ArrowDown': case 's': movePlayer(0, 1); break;
        case 'ArrowLeft': case 'a': movePlayer(-1, 0); break;
        case 'ArrowRight': case 'd': movePlayer(1, 0); break;
        case ' ': case 'Enter': 
            const currentSite = DIG_SITES.find(s => s.x === playerData?.x && s.y === playerData?.y);
            const isDug = currentSite ? (playerData?.dugSites || []).includes(currentSite.id) : false;
            const isOpenedChest = currentSite?.type === 'chest' ? (playerData?.answeredChests || []).includes(currentSite.chestId) : false;
            
            // Pilih action secara otomatis berdasarkan objek yang diinjak
            if (currentSite && currentSite.type === 'chest' && isDug && !isOpenedChest) {
                handleInteract(currentSite.chestId);
            } else {
                handleDig();
            }
            break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePlayer, playerData, activeQuestion, view]);

  const showDigMessage = (msg) => {
      setDigMessage(msg);
      setTimeout(() => setDigMessage(null), 3000); // Pesan tampil sedikit lebih lama agar terbaca
  };

  const handleAnswerSubmit = async (chestId, isCorrect, pointsEarned) => {
    if (!user || !playerData) return;

    const finalPoints = isCorrect ? pointsEarned : 1;
    const newScore = playerData.score + finalPoints;
    const newAnswered = [...playerData.answeredChests, chestId];

    try {
        const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid);
        await updateDoc(playerRef, {
            score: newScore,
            answeredChests: newAnswered
        });
        
        setScoreNotification({ correct: isCorrect, points: finalPoints });
        setTimeout(() => setScoreNotification(null), 3000);
        setActiveQuestion(null);
    } catch (e) {
        console.error("Answer submission error:", e);
    }
  };

  const getCameraStyle = () => {
      if (!playerData) return {};
      // Memposisikan karakter di tengah viewport
      return {
          transform: `translate(calc(50vw - ${playerData.x * TILE_SIZE + TILE_SIZE/2}px), calc(50vh - ${playerData.y * TILE_SIZE + TILE_SIZE/2}px))`
      };
  };

  if (!user) return <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white">Loading Auth...</div>;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-900 text-slate-100 font-sans overflow-hidden touch-none select-none">
      <style>{`
        /* CSS Pattern untuk Tekstur Rumput dan Bintik-bintiknya */
        .map-tile-grass {
            background-color: #558b2f;
            background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h22v2H22v2h22v2H22v2h22v2H22v2h22v2H22v2h22v2H22v2h22v2H22v2h22v2H22v20z' fill='%2333691e' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E");
        }
        /* CSS Pattern untuk Tekstur Air Laut dan Animasi Ombaknya */
        .map-tile-water {
            background-color: #1976d2;
            background-image: repeating-linear-gradient(45deg, #2196f3 25%, transparent 25%, transparent 75%, #2196f3 75%, #2196f3), repeating-linear-gradient(45deg, #2196f3 25%, #1976d2 25%, #1976d2 75%, #2196f3 75%, #2196f3);
            background-position: 0 0, 10px 10px;
            background-size: 20px 20px;
            animation: ocean 3s linear infinite;
        }
        @keyframes ocean {
            from { background-position: 0 0, 10px 10px; }
            to { background-position: 20px 20px, 30px 30px; }
        }
        /* Efek 3D Shadow pada objek */
        .sprite-3d { filter: drop-shadow(2px 6px 4px rgba(0,0,0,0.6)); }
        /* Animasi mengapung untuk peti yang belum dibuka */
        .chest-pulse { animation: chest-pulse 2s infinite ease-in-out; filter: drop-shadow(0 0 8px rgba(255,215,0,0.8)); }
        @keyframes chest-pulse {
            0%, 100% { transform: scale(1) translateY(0); }
            50% { transform: scale(1.05) translateY(-2px); }
        }
      `}</style>

      {/* FLOATING UI HUD (Gaya RPG) */}
      {view === 'game' && playerData && (
          <>
            {/* HUD: Mini-map (Kiri Atas) */}
            <div className="absolute top-4 left-4 z-50 w-28 h-28 bg-[#1e293b] border-4 border-[#334155] rounded-lg shadow-2xl pointer-events-none overflow-hidden opacity-90">
                <div className="relative w-full h-full">
                    {TERRAIN.map((t, i) => (
                        <div key={`mm-${i}`} className={`absolute w-[2.5px] h-[2.5px] ${t.type === 'water' ? 'bg-blue-600' : 'bg-green-600'}`} style={{ left: t.x * 2.5, top: t.y * 2.5 }} />
                    ))}
                    {DIG_SITES.map(site => {
                        const isDug = (playerData?.dugSites || []).includes(site.id);
                        const isOpened = site.type === 'chest' && (playerData?.answeredChests || []).includes(site.chestId);
                        
                        let color = 'bg-red-500/80'; // X mark belum digali
                        if (isDug && site.type === 'zonk') color = 'bg-gray-800'; // Lubang zonk
                        else if (isDug && site.type === 'chest' && !isOpened) color = 'bg-yellow-400 animate-pulse'; // Peti utuh
                        else if (isOpened) color = 'bg-gray-400'; // Peti terbuka
                        
                        return <div key={`mmc-${site.id}`} className={`absolute w-[4px] h-[4px] z-10 rounded-full ${color}`} style={{ left: site.x * 2.5 - 0.5, top: site.y * 2.5 - 0.5 }} />
                    })}
                    {/* Posisi Pemain (Titik Putih Berkedip) */}
                    <div className="absolute w-[6px] h-[6px] bg-white rounded-full z-20 shadow-[0_0_4px_white] animate-pulse" style={{ left: playerData.x * 2.5 - 1.5, top: playerData.y * 2.5 - 1.5 }} />
                </div>
            </div>

            {/* HUD: Tombol Admin & Info Pemain (Kanan Atas) */}
            <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
                <button onClick={() => setView('admin')} className="pointer-events-auto w-16 h-16 bg-[#8b5a2b] border-4 border-[#5c3a18] rounded-xl flex items-center justify-center shadow-lg hover:brightness-110 active:scale-95 transition-all text-[#faedcd] flex-col" style={{backgroundImage: "url('https://www.transparenttextures.com/patterns/wood-pattern.png')"}}>
                    <span className="text-2xl drop-shadow-md">🗝️</span>
                    <span className="text-[10px] font-black leading-none drop-shadow-md mt-1">GURU</span>
                </button>
                
                <div className="bg-black/60 backdrop-blur-sm border-2 border-[#8b5a2b] p-2 px-4 rounded-xl text-white flex flex-col items-end pointer-events-auto shadow-lg">
                    <div className="font-bold text-sm text-gray-200">{playerData.name}</div>
                    <div className="text-amber-400 font-black flex items-center gap-1 text-lg">
                        ⭐ {playerData.score}
                    </div>
                </div>
            </div>
          </>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 relative bg-black overflow-hidden">
        
        {/* VIEW: LOGIN */}
        {view === 'login' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                <LoginScreen onJoin={handleJoin} />
            </div>
        )}

        {/* VIEW: GAME MAP */}
        {view === 'game' && playerData && (
            <>
                {/* Camera Container (Mengikuti posisi pemain) */}
                <div 
                    className="absolute transition-transform duration-200 ease-linear"
                    style={{
                        width: MAP_WIDTH * TILE_SIZE,
                        height: MAP_HEIGHT * TILE_SIZE,
                        ...getCameraStyle()
                    }}
                >
                    {/* Render Terrain Grid (Layer Daratan dan Air) */}
                    {TERRAIN.map((tile, i) => (
                        <div key={`tile-${i}`} className={`absolute ${tile.type === 'water' ? 'map-tile-water' : 'map-tile-grass'}`}
                             style={{ left: tile.x * TILE_SIZE, top: tile.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
                        </div>
                    ))}

                    {/* Render Environment (Layer Dekorasi dan Rintangan) */}
                    {ENVIRONMENT.map((env, i) => (
                        <div key={`env-${i}`} className={`absolute flex items-center justify-center ${env.isObstacle ? 'text-4xl sprite-3d z-20' : 'text-2xl z-10 opacity-80'}`}
                             style={{ left: env.x * TILE_SIZE, top: env.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
                            {env.type}
                        </div>
                    ))}

                    {/* Render Titik Galian (X) & Peti Harta Karun */}
                    {DIG_SITES.map(site => {
                        const isDug = (playerData?.dugSites || []).includes(site.id);
                        const isOpened = site.type === 'chest' && (playerData?.answeredChests || []).includes(site.chestId);
                        
                        let icon = '';
                        let animationClass = '';
                        
                        if (!isDug) {
                            icon = '❌'; 
                            animationClass = 'opacity-80 scale-75 hover:scale-90 transition-transform cursor-pointer drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]'; // Tanda silang
                        } else if (site.type === 'zonk') {
                            icon = '🕳️'; 
                            animationClass = 'opacity-60 scale-75'; // Lubang kosong
                        } else if (site.type === 'chest') {
                            if (isOpened) {
                                icon = '📦'; 
                                animationClass = 'opacity-80'; // Kotak terbuka
                            } else {
                                icon = '🧰'; 
                                animationClass = 'chest-pulse z-20'; // Peti berkilau
                            }
                        }

                        return (
                            <div key={site.id} className={`absolute flex items-center justify-center z-10 ${animationClass}`}
                                 style={{ left: site.x * TILE_SIZE, top: site.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
                                <span className="text-4xl sprite-3d">{icon}</span>
                            </div>
                        );
                    })}

                    {/* Render Players */}
                    {Object.values(players).map(p => (
                        <div key={p.uid} className="absolute flex flex-col items-center justify-center transition-all duration-150 z-30"
                             style={{ left: p.x * TILE_SIZE, top: p.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
                            <div className="relative">
                                <span className="text-[44px] sprite-3d leading-none">{p.character}</span>
                                {p.uid === user.uid && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white animate-bounce shadow-[0_0_10px_yellow]"></div>
                                )}
                            </div>
                            <span className="text-[10px] font-bold mt-1 bg-black/70 text-white px-2 py-0.5 rounded-full truncate max-w-[80px] text-center shadow-md">
                                {p.name}
                            </span>
                        </div>
                    ))}
                </div>

                {/* UI: On-Screen D-Pad */}
                <div className="absolute bottom-8 left-8 w-40 h-40 bg-black/40 backdrop-blur-md rounded-full border-4 border-white/20 p-2 z-30 shadow-2xl">
                    <div className="relative w-full h-full">
                        <button 
                            onPointerDown={() => startMove(0, -1)} onPointerUp={stopMove} onPointerLeave={stopMove} onContextMenu={e=>e.preventDefault()}
                            className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-white/20 active:bg-white/50 rounded-t-xl flex items-center justify-center text-white font-black text-xl shadow-md border-t border-white/30">↑</button>
                        <button 
                            onPointerDown={() => startMove(-1, 0)} onPointerUp={stopMove} onPointerLeave={stopMove} onContextMenu={e=>e.preventDefault()}
                            className="absolute top-1/2 left-0 -translate-y-1/2 w-12 h-12 bg-white/20 active:bg-white/50 rounded-l-xl flex items-center justify-center text-white font-black text-xl shadow-md border-l border-white/30">←</button>
                        <button 
                            onPointerDown={() => startMove(1, 0)} onPointerUp={stopMove} onPointerLeave={stopMove} onContextMenu={e=>e.preventDefault()}
                            className="absolute top-1/2 right-0 -translate-y-1/2 w-12 h-12 bg-white/20 active:bg-white/50 rounded-r-xl flex items-center justify-center text-white font-black text-xl shadow-md border-r border-white/30">→</button>
                        <button 
                            onPointerDown={() => startMove(0, 1)} onPointerUp={stopMove} onPointerLeave={stopMove} onContextMenu={e=>e.preventDefault()}
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-white/20 active:bg-white/50 rounded-b-xl flex items-center justify-center text-white font-black text-xl shadow-md border-b border-white/30">↓</button>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 rounded-full border border-white/20"></div>
                    </div>
                </div>

                {/* UI: Interact Button (GALI / BUKA) */}
                <div className="absolute bottom-10 right-10 z-30">
                    {(() => {
                        const currentSite = DIG_SITES.find(s => s.x === playerData.x && s.y === playerData.y);
                        const isDug = currentSite ? (playerData.dugSites || []).includes(currentSite.id) : false;
                        const isOpenedChest = currentSite?.type === 'chest' ? (playerData.answeredChests || []).includes(currentSite.chestId) : false;

                        const showBukaBtn = currentSite && currentSite.type === 'chest' && isDug && !isOpenedChest;

                        if (showBukaBtn) {
                            return (
                                <button 
                                    onClick={() => handleInteract(currentSite.chestId)}
                                    className="w-24 h-24 bg-[#faedcd] hover:bg-[#e9edc9] active:scale-95 rounded-full shadow-[0_8px_0_#8b5a2b,0_15px_20px_rgba(0,0,0,0.6)] border-4 border-[#5c3a18] flex flex-col items-center justify-center transition-all text-[#3e2723]"
                                >
                                    <span className="text-3xl mb-1">🧰</span>
                                    <span className="font-black text-xs tracking-wider">BUKA</span>
                                </button>
                            );
                        } else {
                            return (
                                <button 
                                    onClick={handleDig}
                                    className="w-24 h-24 bg-[#e9edc9] hover:bg-[#ccd5ae] active:scale-95 rounded-full shadow-[0_8px_0_#558b2f,0_15px_20px_rgba(0,0,0,0.6)] border-4 border-[#558b2f] flex flex-col items-center justify-center transition-all text-[#3e2723]"
                                >
                                    <span className="text-3xl mb-1">⛏️</span>
                                    <span className="font-black text-xs tracking-wider">GALI</span>
                                </button>
                            );
                        }
                    })()}
                </div>

                {/* Pesan Error Singkat (Interaksi) */}
                {digMessage && (
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full font-bold shadow-2xl z-40 animate-pulse border-2 border-amber-500/50 backdrop-blur-sm text-center">
                        {digMessage}
                    </div>
                )}
            </>
        )}

        {view === 'admin' && (
            <div className="absolute inset-0 z-50 bg-slate-900">
                <AdminPanel players={players} onBack={() => setView(playerData ? 'game' : 'login')} />
            </div>
        )}

        {activeQuestion && (
            <QuestionModal 
                question={activeQuestion} 
                onClose={() => setActiveQuestion(null)}
                onSubmit={(isCorrect) => handleAnswerSubmit(activeQuestion.id, isCorrect, activeQuestion.points)}
            />
        )}

        {scoreNotification && (
            <div className={`absolute top-24 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl text-white font-bold shadow-2xl border-4 z-[60] animate-bounce text-center backdrop-blur-md
                            ${scoreNotification.correct ? 'bg-green-500/90 border-green-300' : 'bg-rose-500/90 border-rose-300'}`}>
                <div className="text-2xl mb-1">{scoreNotification.correct ? '🎉 YAY!' : 'Oops!'}</div>
                <div>{scoreNotification.correct ? 'Jawaban Tepat!' : 'Tetap Semangat!'} +{scoreNotification.points} Poin</div>
            </div>
        )}

      </main>
    </div>
  );
}

function LoginScreen({ onJoin }) {
    const [name, setName] = useState('');
    const [char, setChar] = useState(CHARACTERS[0]);

    return (
        <div className="bg-[#faedcd] p-8 rounded-3xl shadow-[0_10px_0_#8b5a2b,0_20px_30px_rgba(0,0,0,0.5)] border-4 border-[#5c3a18] max-w-md w-full flex flex-col items-center gap-6 relative overflow-hidden text-[#3e2723]">
            <div className="text-center z-10">
                <h2 className="text-3xl font-black mb-2 tracking-wide uppercase text-[#8b5a2b]">Mulai Game</h2>
                <p className="text-sm font-semibold opacity-80">Siapkan cangkulmu dan cari peti rahasia!</p>
            </div>

            <div className="w-full z-10 flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-bold mb-1">Nama Karakter</label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={20} />
                        <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ketik namamu..."
                            className="w-full bg-white border-2 border-[#8b5a2b] rounded-xl py-3 pl-10 pr-4 font-bold text-lg focus:outline-none focus:ring-4 focus:ring-[#ccd5ae]"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold mb-1">Pilih Avatar</label>
                    <div className="flex justify-between bg-[#e9edc9] p-2 rounded-xl border-2 border-[#ccd5ae]">
                        {CHARACTERS.map(c => (
                            <button 
                                key={c}
                                onClick={() => setChar(c)}
                                className={`text-3xl p-2 rounded-lg transition-transform ${char === c ? 'bg-[#8bc34a] scale-110 shadow-md border-2 border-white' : 'hover:bg-white/50 opacity-50'}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={() => onJoin(name, char)}
                    disabled={!name.trim()}
                    className="w-full bg-[#8bc34a] hover:bg-[#7cb342] active:translate-y-2 text-white font-black text-xl py-4 px-4 rounded-xl shadow-[0_6px_0_#558b2f] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:active:translate-y-0 mt-4 border-2 border-white/20"
                >
                    <Play fill="currentColor" size={24} />
                    MAIN SEKARANG
                </button>
            </div>
        </div>
    );
}

function QuestionModal({ question, onClose, onSubmit }) {
    const [pgAnswer, setPgAnswer] = useState(null);
    const [pgkAnswers, setPgkAnswers] = useState([]);
    const [bsAnswer, setBsAnswer] = useState(null);
    const [matchAnswers, setMatchAnswers] = useState(Array(question.items?.length).fill(''));
    const [esaiAnswer, setEsaiAnswer] = useState('');

    const handleSubmit = () => {
        let isCorrect = false;
        switch (question.type) {
            case 'PG': isCorrect = pgAnswer === question.answer; break;
            case 'PG_KOMPLEKS':
                const sortedSelected = [...pgkAnswers].sort();
                const sortedCorrect = [...question.answers].sort();
                isCorrect = sortedSelected.length === sortedCorrect.length && sortedSelected.every((val, index) => val === sortedCorrect[index]);
                break;
            case 'BS': isCorrect = bsAnswer === question.answer; break;
            case 'MATCHING':
                isCorrect = matchAnswers.every((ans, idx) => {
                    const optionIdx = question.options.findIndex(opt => opt.startsWith(ans));
                    return optionIdx === question.answers[idx];
                });
                break;
            case 'ESAI':
                if (question.keyword && esaiAnswer.length > 10) {
                    const found = question.keyword.filter(kw => esaiAnswer.toLowerCase().includes(kw.toLowerCase()));
                    isCorrect = found.length >= 2;
                }
                break;
        }
        onSubmit(isCorrect);
    };

    return (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-[#faedcd] border-4 border-[#8b5a2b] rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl text-[#3e2723]">
                <div className="flex justify-between items-start mb-4 border-b-2 border-[#d4a373] pb-4">
                    <div>
                        <h3 className="font-black text-2xl flex items-center gap-2">
                            <span>📜</span> Kuis Ditemukan!
                        </h3>
                        <p className="text-sm font-bold opacity-70 mt-1">
                            Tipe: {question.type.replace('_', ' ')} | Poin: {question.points}
                        </p>
                    </div>
                    <button onClick={onClose} className="bg-red-500 hover:bg-red-600 text-white rounded-xl p-2 border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all">
                        <X size={20} font="bold" />
                    </button>
                </div>

                <div className="mb-6 bg-white p-4 rounded-xl border-2 border-[#e9edc9]">
                    <p className="text-lg font-semibold leading-relaxed">{question.text}</p>
                </div>

                {/* INPUT RENDERING BASED ON TYPE */}
                {question.type === 'PG' && (
                    <div className="flex flex-col gap-3">
                        {question.options.map((opt, idx) => (
                            <button key={idx} onClick={() => setPgAnswer(idx)}
                                className={`text-left p-4 rounded-xl border-2 font-bold transition-all ${pgAnswer === idx ? 'bg-[#8bc34a] border-[#558b2f] text-white shadow-inner' : 'bg-white border-[#d4a373] hover:bg-[#e9edc9]'}`}>
                                {String.fromCharCode(65 + idx)}. {opt}
                            </button>
                        ))}
                    </div>
                )}

                {question.type === 'PG_KOMPLEKS' && (
                    <div className="flex flex-col gap-3">
                         {question.options.map((opt, idx) => {
                            const isSelected = pgkAnswers.includes(idx);
                            return (
                                <button key={idx} onClick={() => setPgkAnswers(prev => isSelected ? prev.filter(a => a !== idx) : [...prev, idx])}
                                    className={`flex items-center gap-3 text-left p-4 rounded-xl border-2 font-bold transition-all ${isSelected ? 'bg-[#8bc34a] border-[#558b2f] text-white shadow-inner' : 'bg-white border-[#d4a373] hover:bg-[#e9edc9]'}`}>
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-white border-white text-[#558b2f]' : 'border-[#d4a373]'}`}>
                                        {isSelected && <Check size={18} strokeWidth={3} />}
                                    </div>
                                    {opt}
                                </button>
                            );
                        })}
                    </div>
                )}

                {question.type === 'BS' && (
                    <div className="grid grid-cols-2 gap-4">
                         <button onClick={() => setBsAnswer(true)} className={`p-4 rounded-xl border-b-4 font-black text-xl transition-all ${bsAnswer === true ? 'bg-green-500 border-green-700 text-white translate-y-1 border-b-0' : 'bg-white border-green-700 text-green-700'}`}>BENAR</button>
                         <button onClick={() => setBsAnswer(false)} className={`p-4 rounded-xl border-b-4 font-black text-xl transition-all ${bsAnswer === false ? 'bg-red-500 border-red-700 text-white translate-y-1 border-b-0' : 'bg-white border-red-700 text-red-700'}`}>SALAH</button>
                    </div>
                )}

                {question.type === 'MATCHING' && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-white p-4 rounded-xl border-2 border-[#e9edc9] mb-2">
                            <p className="text-sm font-black opacity-70 mb-2">Pilihan Jawaban:</p>
                            <ul className="text-sm font-semibold grid grid-cols-1 gap-2">
                                {question.options.map((opt, i) => <li key={i}>{opt}</li>)}
                            </ul>
                        </div>
                        {question.items.map((item, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between bg-white p-3 rounded-xl border-2 border-[#d4a373]">
                                <span className="font-bold">{idx + 1}. {item}</span>
                                <select 
                                    value={matchAnswers[idx]} onChange={(e) => { const newAns = [...matchAnswers]; newAns[idx] = e.target.value; setMatchAnswers(newAns); }}
                                    className="bg-[#e9edc9] text-[#3e2723] border-2 border-[#8b5a2b] font-bold rounded-lg p-2 outline-none"
                                >
                                    <option value="">- Pilih -</option>
                                    {['A', 'B', 'C', 'D', 'E'].map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                )}

                {question.type === 'ESAI' && (
                    <textarea 
                        rows="5" placeholder="Ketik jawaban Anda di sini..."
                        value={esaiAnswer} onChange={(e) => setEsaiAnswer(e.target.value)}
                        className="w-full bg-white text-[#3e2723] font-semibold border-2 border-[#8b5a2b] rounded-xl p-4 focus:outline-none focus:ring-4 focus:ring-[#ccd5ae] resize-none"
                    ></textarea>
                )}

                <div className="mt-8 flex justify-end">
                    <button onClick={handleSubmit} className="bg-[#8b5a2b] hover:bg-[#724a22] text-white font-black text-lg py-3 px-8 rounded-xl border-b-4 border-[#5c3a18] active:border-b-0 active:translate-y-1 transition-all">
                        Kirim Jawaban
                    </button>
                </div>
            </div>
        </div>
    );
}

function AdminPanel({ players, onBack }) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState(null);

    const handleDownloadCSV = () => {
        const headers = ['Nama Siswa', 'Karakter', 'Skor Akhir (Max 100)', 'Peti Dibuka'];
        const rows = Object.values(players)
            .sort((a, b) => b.score - a.score)
            .map(p => [`"${p.name}"`, p.character, p.score, p.answeredChests?.length || 0]);
        
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Nilai_Informatika_Fase_E.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSyncToSpreadsheet = async () => {
        setIsSyncing(true);
        setSyncMessage('Sedang menyinkronkan...');
        try {
            // Memformat data pemain
            const rows = Object.values(players)
                .sort((a, b) => b.score - a.score)
                .map(p => ({
                    nama: p.name,
                    karakter: p.character,
                    peti_dibuka: p.answeredChests?.length || 0,
                    skor: p.score
                }));

            // TODO: GANTI URL DI BAWAH INI DENGAN URL WEBHOOK GOOGLE APPS SCRIPT ANDA
            const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxgQVhC7iELXmwYnYiDcwsIiqGcrI4FZgVsF3SOu266fbgCb4pF7L8KCu63cNySdQ6mYA/exec';
            
            if (WEBHOOK_URL === 'YOUR_GOOGLE_SCRIPT_WEBHOOK_URL_HERE') {
                setSyncMessage('⚠️ Ganti URL Webhook Google Script di dalam kode terlebih dahulu!');
                setIsSyncing(false);
                setTimeout(() => setSyncMessage(null), 5000);
                return;
            }

            // Mengirim data ke Google Apps Script (Menggunakan mode no-cors untuk menghindari blokir dari Google)
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                mode: 'no-cors', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: rows })
            });

            setSyncMessage('✅ Berhasil sinkronisasi ke Spreadsheet!');
        } catch (error) {
            setSyncMessage('❌ Gagal: ' + error.message);
        }
        setIsSyncing(false);
        setTimeout(() => setSyncMessage(null), 4000);
    };

    return (
        <div className="w-full h-full p-8 bg-slate-900 overflow-y-auto text-slate-100">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600">
                            <X size={24} />
                        </button>
                        <div>
                            <h2 className="text-3xl font-bold mb-1">Dashboard Guru</h2>
                            <p className="text-slate-400">Monitoring progres siswa dan rekap ke Spreadsheet.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {syncMessage && (
                            <span className={`text-sm font-bold ${syncMessage.includes('✅') ? 'text-green-400' : syncMessage.includes('❌') || syncMessage.includes('⚠️') ? 'text-red-400' : 'text-blue-400'} animate-pulse`}>
                                {syncMessage}
                            </span>
                        )}
                        <button 
                            onClick={handleSyncToSpreadsheet} 
                            disabled={isSyncing}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all border border-blue-500 shadow-lg"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                            {isSyncing ? 'Loading...' : 'Sync ke G-Sheets'}
                        </button>
                        <button onClick={handleDownloadCSV} className="bg-emerald-600 hover:bg-emerald-500 font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all shadow-lg">
                            <Download size={18} /> Export CSV
                        </button>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-700/50 text-slate-200 uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Siswa</th>
                                    <th className="px-6 py-4">Karakter</th>
                                    <th className="px-6 py-4">Peti Diselesaikan</th>
                                    <th className="px-6 py-4">Skor Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {Object.values(players).sort((a, b) => b.score - a.score).map(p => (
                                    <tr key={p.uid} className="hover:bg-slate-750">
                                        <td className="px-6 py-4 font-medium text-white">{p.name}</td>
                                        <td className="px-6 py-4 text-2xl">{p.character}</td>
                                        <td className="px-6 py-4">{p.answeredChests?.length || 0} / 23</td>
                                        <td className="px-6 py-4 font-bold text-amber-500">{p.score}</td>
                                    </tr>
                                ))}
                                {Object.keys(players).length === 0 && (
                                    <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500 italic">Belum ada siswa yang bergabung.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}