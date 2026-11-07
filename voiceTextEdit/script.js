const formatBtn = document.getElementById('format-btn');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const rawTextInput = document.getElementById('raw-text-input');
const textInput = document.getElementById('text-input');
const statusMessage = document.getElementById('status-message');

// 新しく取得する置換用要素
const replaceBtn = document.getElementById('replace-btn');
const findWordInput = document.getElementById('find-word');
const replaceWordInput = document.getElementById('replace-word');

// 成形ボタンが押された時の処理
formatBtn.addEventListener('click', () => {
    const rawText = rawTextInput.value;
    if (!rawText.trim()) {
        alert('左側の欄にテキストを入力してください。');
        return;
    }

    const lines = rawText.split('\n').map(line => line.trim());
    const validLines = lines.filter(line => line.length > 0);
    const reversedLines = validLines.reverse();
    const formattedText = reversedLines.join('');

    const currentRightText = textInput.value;
    if (currentRightText.length > 0) {
        textInput.value = currentRightText + '\n' + formattedText;
    } else {
        textInput.value = formattedText;
    }

    rawTextInput.value = '';
    
    statusMessage.textContent = 'テキストを成形して右側に追加しました。';
    setTimeout(() => {
        if (statusMessage.textContent === 'テキストを成形して右側に追加しました。') {
            statusMessage.textContent = '';
        }
    }, 2000);
});

// 【新設】一括置換ボタンが押された時の処理
replaceBtn.addEventListener('click', () => {
    const currentText = textInput.value;
    const findWord = findWordInput.value;
    const replaceWord = replaceWordInput.value;

    if (!currentText.trim()) {
        alert('右側の蓄積エリアにテキストがありません。');
        return;
    }
    if (!findWord) {
        alert('置換前の単語を入力してください。');
        return;
    }

    // 文字列内の該当する単語をすべて安全に置換
    // 正規表現のエスケープ処理を簡易的に施してすべて置換 (replaceAll)
    const escapedFindWord = findWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedFindWord, 'g');
    const newText = currentText.replace(regex, replaceWord);

    if (currentText === newText) {
        statusMessage.textContent = '該当する単語が見つかりませんでした。';
    } else {
        textInput.value = newText;
        statusMessage.textContent = `単語「${findWord}」を「${replaceWord}」に一括置換しました。`;
        // 置換が成功したら入力欄をリセット
        findWordInput.value = '';
        replaceWordInput.value = '';
    }

    setTimeout(() => {
        if (statusMessage.textContent.includes('置換') || statusMessage.textContent.includes('見つかりませんでした')) {
            statusMessage.textContent = '';
        }
    }, 2000);
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
    link.download = `formatted_text_${timestamp}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    statusMessage.textContent = '成形済みテキストファイルを保存しました。';
    setTimeout(() => {
        if (statusMessage.textContent === '成形済みテキストファイルを保存しました。') {
            statusMessage.textContent = '';
        }
    }, 2000);
});

// クリアボタンが押された時の処理
clearBtn.addEventListener('click', () => {
    textInput.value = '';
    statusMessage.textContent = '右側の蓄積エリアをクリアしました。';
    setTimeout(() => {
        if (statusMessage.textContent === '右側の蓄積エリアをクリアしました。') {
            statusMessage.textContent = '';
        }
    }, 2000);
});
