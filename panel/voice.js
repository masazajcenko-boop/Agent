'use strict';

// Голосовой режим Авроры.
// «Аврора» начинает диктовку. Текст появляется в поле задачи, но не отправляется
// автоматически. «Отправить» / «Отправь» отправляет подготовленный текст.
// 10 секунд тишины возвращают режим к ожиданию имени, сохраняя черновик.

(() => {
  const toggle = document.getElementById('voiceToggle');
  const status = document.getElementById('voiceStatus');
  const task = document.getElementById('task');
  const run = document.getElementById('run');
  if (!toggle || !status || !task || !run) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let enabled = false;
  let mode = 'wake';
  let restartTimer = null;
  let silenceTimer = null;
  let voiceDraft = '';
  let baseText = '';
  let starting = false;

  const setStatus = (message) => {
    status.textContent = message;
    status.hidden = !enabled;
  };

  const normalize = (value) => String(value || '')
    .toLocaleLowerCase('ru-RU')
    .replace(/[.,!?;:()[\]{}«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  function clearSilenceTimer() {
    if (silenceTimer !== null) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  function clearRestartTimer() {
    if (restartTimer !== null) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function combineDraft() {
    return [baseText.trim(), voiceDraft.trim()].filter(Boolean).join(' ').trim();
  }

  function showDraft() {
    task.value = combineDraft();
    task.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function returnToWakeMode() {
    clearSilenceTimer();
    showDraft();
    voiceDraft = '';
    baseText = task.value.trim();
    mode = 'wake';
    if (enabled) setStatus(baseText
      ? 'Черновик сохранён. Аврора ждёт имя «Аврора»…'
      : 'Аврора ждёт имя «Аврора»…');
  }

  function sendDraft() {
    clearSilenceTimer();
    showDraft();
    const message = task.value.trim();
    voiceDraft = '';
    baseText = '';
    mode = 'wake';

    if (message) {
      setStatus('Отправляю сообщение…');
      run.click();
      if (enabled) setStatus('Сообщение отправлено. Аврора ждёт имя «Аврора»…');
    } else if (enabled) {
      setStatus('Сообщение пустое. Аврора ждёт имя «Аврора»…');
    }
  }

  function armSilenceTimer() {
    clearSilenceTimer();
    silenceTimer = setTimeout(returnToWakeMode, 10000);
  }

  function removeWakeWord(text) {
    return String(text || '').replace(/^\s*аврора[\s,.:;!?—-]*/i, '').trim();
  }

  function isSendCommand(text) {
    return /(?:^|\s)(?:отправить|отправь|отправляй)$/i.test(normalize(text));
  }

  function removeSendCommand(text) {
    return String(text || '').replace(/(?:^|\s)(?:отправить|отправь|отправляй)[.!?,;:]*\s*$/i, '').trim();
  }

  function handleFinalTranscript(rawText) {
    if (!enabled) return;
    const transcript = String(rawText || '').trim();
    if (!transcript) return;

    if (mode === 'wake') {
      if (!/(^|\s)аврора(\s|$)/i.test(normalize(transcript))) return;
      mode = 'command';
      baseText = task.value.trim();
      voiceDraft = '';
      const afterWakeWord = removeWakeWord(transcript);
      if (afterWakeWord) {
        if (isSendCommand(afterWakeWord)) {
          sendDraft();
          return;
        }
        voiceDraft = afterWakeWord;
      }
      showDraft();
      setStatus('Диктую в черновик. Скажи «отправить», когда будешь готов.');
      armSilenceTimer();
      return;
    }

    const cleaned = removeWakeWord(transcript);
    if (isSendCommand(cleaned)) {
      const textWithoutCommand = removeSendCommand(cleaned);
      if (textWithoutCommand) voiceDraft = [voiceDraft, textWithoutCommand].filter(Boolean).join(' ').trim();
      sendDraft();
      return;
    }

    if (cleaned) voiceDraft = [voiceDraft, cleaned].filter(Boolean).join(' ').trim();
    showDraft();
    setStatus('Черновик обновлён. Скажи «отправить» или сделай паузу.');
    armSilenceTimer();
  }

  function scheduleRestart() {
    clearRestartTimer();
    if (!enabled || !recognition) return;
    restartTimer = setTimeout(() => {
      if (!enabled || !recognition || starting) return;
      try {
        starting = true;
        recognition.start();
      } catch (error) {
        if (error && error.name !== 'InvalidStateError') {
          console.warn('Aurora voice: не удалось перезапустить распознавание.', error);
        }
      }
    }, 300);
  }

  function createRecognition() {
    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      starting = false;
      if (enabled && mode === 'wake') setStatus('Аврора ждёт имя «Аврора»…');
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result && result.isFinal && result[0]) handleFinalTranscript(result[0].transcript);
      }
    };

    recognition.onerror = (event) => {
      starting = false;
      if (!enabled) return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        enabled = false;
        clearSilenceTimer();
        clearRestartTimer();
        toggle.setAttribute('aria-pressed', 'false');
        toggle.setAttribute('aria-label', 'Включить голосовой режим');
        setStatus('Доступ к микрофону запрещён. Разреши его в настройках сайта.');
        status.hidden = false;
        return;
      }
      if (event.error === 'audio-capture') setStatus('Микрофон не найден или занят другим приложением.');
    };

    recognition.onend = () => {
      starting = false;
      if (enabled) scheduleRestart();
    };
  }

  function enable() {
    if (!SpeechRecognition) {
      status.hidden = false;
      status.textContent = 'В этом браузере нет поддержки распознавания речи. Попробуй актуальный Chrome.';
      return;
    }

    enabled = true;
    mode = 'wake';
    voiceDraft = '';
    baseText = task.value.trim();
    toggle.setAttribute('aria-pressed', 'true');
    toggle.setAttribute('aria-label', 'Выключить голосовой режим');
    status.hidden = false;
    setStatus('Запрашиваю доступ к микрофону…');

    try {
      createRecognition();
      starting = true;
      recognition.start();
    } catch (error) {
      starting = false;
      enabled = false;
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', 'Включить голосовой режим');
      setStatus('Не удалось включить микрофон. Попробуй нажать кнопку ещё раз.');
      status.hidden = false;
      console.warn('Aurora voice: запуск не удался.', error);
    }
  }

  function disable() {
    enabled = false;
    clearSilenceTimer();
    clearRestartTimer();
    if (mode === 'command') showDraft();
    voiceDraft = '';
    baseText = '';
    mode = 'wake';
    starting = false;
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', 'Включить голосовой режим');
    setStatus('Голосовой режим выключен');
    status.hidden = true;
    if (recognition) {
      recognition.onend = null;
      try { recognition.stop(); } catch (_) {}
      recognition = null;
    }
  }

  toggle.addEventListener('click', () => {
    if (enabled) disable();
    else enable();
  });

  window.addEventListener('pagehide', disable);
})();
