const voicevoxUrl = 'http://127.0.0.1:50121'; // Nemo用ポート
let speakerId = 10005; // Nemo女性ボイス

// 句点（文章の区切り）で空けたい間の長さ（ミリ秒単位。1000 = 1秒 / 500 = 0.5秒）
const sentencePauseDuration = 800; 

const speakBtn = document.getElementById('speak-btn');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const textInput = document.getElementById('text-input');
const statusMessage = document.getElementById('status-message');
const characterThumb = document.getElementById('character-thumb');

// スライダー要素の取得
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');

const characterNameDisplay = document.getElementById('character-name-display');
const switchSpeakerBtn = document.getElementById('switch-speaker-btn');
// 新しい要素の取得
const loadBtn = document.getElementById('load-btn');
const fileLoader = document.getElementById('file-loader');

let textSentences = [];  // 分割された文章の配列
let audioUrls = [];      // 合成された音声URLを格納する配列
let generateIndex = 0;   // 次に合成する文章のインデックス
let playIndex = 0;       // 現在再生中の文章のインデックス
let currentAudio = null; // 現在再生中のAudioオブジェクト
let isPlaying = false;   // 再生中フラグ
let isGenerating = false;// 先読み合成中フラグ
let pauseTimeout = null; // 間を置いている最中のタイマー保持用

// スライダー変更時に表示を固定
speedSlider.addEventListener('input', () => {
    speedValue.textContent = parseFloat(speedSlider.value).toFixed(1);
});
volumeSlider.addEventListener('input', () => {
    volumeValue.textContent = parseFloat(volumeSlider.value).toFixed(1);
});

// 保存ボタンが押された時の処理
saveBtn.addEventListener('click', () => {
    const text = textInput.value;
    if (!text.trim()) {
        alert('保存するテキストがありません。');
        return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${date}_${hours}${minutes}${seconds}`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `speech_text_${timestamp}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    statusMessage.textContent = 'テキストファイルを保存しました。';
    setTimeout(() => {
        if (statusMessage.textContent === 'テキストファイルを保存しました。') {
            statusMessage.textContent = '';
        }
    }, 2000);
});

// クリアボタンが押された時の処理
clearBtn.addEventListener('click', () => {
    if (isPlaying) {
        stopPlayback();
    }
    textInput.value = '';
    statusMessage.textContent = 'クリアしました。';
    setTimeout(() => {
        if (!isPlaying && statusMessage.textContent === 'クリアしました。') {
            statusMessage.textContent = '';
        }
    }, 2000);
});

// 再生ボタンが押された時の処理
speakBtn.addEventListener('click', async () => {
    if (isPlaying) {
        stopPlayback();
        return;
    }

    // ★修正: テキストエリア内でユーザーが選択（反転）している文字列を取得
    const selection = textInput.value.substring(textInput.selectionStart, textInput.selectionEnd).trim();
    
    // 選択されている文字列があればそれを読み上げ、なければ全体の文字列を読み上げる
    const text = selection ? selection : textInput.value.trim();

    if (!text) {
        alert('テキストを入力するか、読み上げたい部分を選択してください。');
        return;
    }

    textSentences = text.split(/[。\n!?！？]+/)
                        .map(s => s.trim())
                        .filter(s => s.length > 0);

    if (textSentences.length === 0) {
        return;
    }

    audioUrls = new Array(textSentences.length).fill(null);
    generateIndex = 0;
    playIndex = 0;
    isPlaying = true;

    speakBtn.textContent = '読み上げを停止する';
    speakBtn.style.backgroundColor = '#8c4343'; 
    
    // ★修正: 選択部分だけを読んでいる場合はステータスを変える
    statusMessage.textContent = selection ? '選択された範囲を準備中...' : '最初の文章を準備中...';

    try {
        await fetchAudioAtIndex(0);
        
        if (isPlaying && audioUrls) {
            playNext();
            startBackgroundGeneration();
        }
    } catch (error) {
        console.error(error);
        alert(`初期化エラー: ${error.message}`);
        stopPlayback();
    }
});


async function startBackgroundGeneration() {
    if (isGenerating || !isPlaying) return;
    isGenerating = true;

    while (generateIndex < textSentences.length && isPlaying) {
        if (generateIndex - playIndex > 3) {
            await new Promise(resolve => setTimeout(resolve, 300));
            continue;
        }

        try {
            await fetchAudioAtIndex(generateIndex);
        } catch (error) {
            console.error(`文目(${generateIndex})の合成に失敗しました:`, error);
            generateIndex++;
        }
    }
    isGenerating = false;
}

// 指定したインデックスの文章をVOICEVOXで合成する関数
async function fetchAudioAtIndex(index) {
    if (index >= textSentences.length || audioUrls[index] !== null) return;
    
    generateIndex = Math.max(generateIndex, index + 1);
    
    const text = textSentences[index];

    const queryUrl = `${voicevoxUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`;
    const queryResponse = await fetch(queryUrl, { method: 'POST' ,mode: 'no-cors'});
    if (!queryResponse.ok) throw new Error('音声クエリの作成に失敗しました。');
    const queryData = await queryResponse.json();

    // スライダーから取得した設定値（話速・音量）を、クエリデータに直接上書き反映させる
    queryData.speedScale = parseFloat(speedSlider.value);
    queryData.volumeScale = parseFloat(volumeSlider.value);

    const synthesisUrl = `${voicevoxUrl}/synthesis?speaker=${speakerId}`;
    const synthesisResponse = await fetch(synthesisUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryData),mode: 'no-cors'
    });
    if (!synthesisResponse.ok) throw new Error('音声の合成に失敗しました。');

    const audioBlob = await synthesisResponse.blob();
    if (isPlaying) {
        audioUrls[index] = URL.createObjectURL(audioBlob);
    }
}

function playNext() {
    if (!isPlaying) return;

    if (playIndex >= textSentences.length) {
        stopPlayback();
        statusMessage.textContent = 'すべての読み上げが完了しました。';
        return;
    }

    if (!audioUrls[playIndex]) {
        statusMessage.textContent = '次の音声を待っています...';
        characterThumb.classList.remove('speaking');
        setTimeout(playNext, 200);
        return;
    }

    statusMessage.textContent = `再生中... (${playIndex + 1} / ${textSentences.length} 文目)`;
    characterThumb.classList.add('speaking');
    
    const currentUrl = audioUrls[playIndex];
    currentAudio = new Audio(currentUrl);
    
    currentAudio.play().catch(err => {
        console.error("再生エラー:", err);
        moveToNext();
    });

    currentAudio.onended = () => {
        moveToNext();
    };
}

function moveToNext() {
    if (audioUrls[playIndex]) {
        URL.revokeObjectURL(audioUrls[playIndex]);
        audioUrls[playIndex] = null;
    }
    playIndex++;

    characterThumb.classList.remove('speaking');

    if (playIndex < textSentences.length && isPlaying) {
        statusMessage.textContent = '間を空けています...';
        pauseTimeout = setTimeout(playNext, sentencePauseDuration);
    } else {
        playNext();
    }
}

function stopPlayback() {
    isPlaying = false;
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (pauseTimeout) {
        clearTimeout(pauseTimeout);
        pauseTimeout = null;
    }
    
    characterThumb.classList.remove('speaking');

    audioUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
    });
    audioUrls = [];

    speakBtn.textContent = '音声を再生する';
    speakBtn.style.backgroundColor = ''; 
    statusMessage.textContent = '';
}

// 木下栞の初期画像パスを保存
const defaultThumbSrc = characterThumb.src || 'shiori.jpg'; 

// 話者切り替えボタンが押された時の処理
switchSpeakerBtn.addEventListener('click', () => {
    if (isPlaying) {
        stopPlayback();
    }

    if (speakerId === 10005) {
        speakerId = 10006;
        characterNameDisplay.textContent = '如月 穂波（ほなみ）';
        characterThumb.src = 'honami.jpg'; 
        switchSpeakerBtn.textContent = '一之瀬 栞 に変更';
    } else {
        speakerId = 10005;
        characterNameDisplay.textContent = '一之瀬 栞（しおり）';
        characterThumb.src = defaultThumbSrc; 
        switchSpeakerBtn.textContent = '如月 穂波 に変更';
    }
    
    statusMessage.textContent = `話者を「${characterNameDisplay.textContent}」に切り替えました。`;
    setTimeout(() => {
        if (!isPlaying && statusMessage.textContent.includes('切り替えました')) {
            statusMessage.textContent = '';
        }
    }, 2000);
});
// 読み込みボタンが押された時に、隠しinputをクリックさせる
loadBtn.addEventListener('click', () => {
    if (isPlaying) {
        stopPlayback();
    }
    fileLoader.click();
});

// ファイルが選択された時の処理
fileLoader.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // すでに入力がある場合は確認ダイアログを表示
    if (textInput.value.trim()) {
        const confirmOverwrite = confirm('現在の入力内容が上書きされますが、よろしいですか？');
        if (!confirmOverwrite) {
            fileLoader.value = ''; // 選択内容をリセットして終了
            return;
        }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        textInput.value = e.target.result;
        statusMessage.textContent = `ファイル「${file.name}」を読み込みました。`;
        
        setTimeout(() => {
            if (statusMessage.textContent.includes('読み込みました')) {
                statusMessage.textContent = '';
            }
        }, 2000);
    };
    
    reader.onerror = () => {
        alert('ファイルの読み込みに失敗しました。');
    };

    reader.readAsText(file, 'utf-8');
    fileLoader.value = ''; // 次回同じファイルを選んでもイベントが発火するようにクリア
});