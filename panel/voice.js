'use strict';

// Голосовой режим Авроры на Web Speech API.
// В режиме ожидания распознаётся только фраза вызова; после вызова вопрос
// можно произносить без ограничения длительности. 10 секунд тишины завершают
// текущий ввод: если был распознан вопрос, он отправляется агенту, затем
// распознавание возвращается к ожиданию слова «Аврора».

(() => {
  const toggle = document.getElementById('voiceToggle');
  const status = document.getElementById('voiceStatus');
  const task = document.getElementById('task');
  const run = document.getElementById('run');
  if (!toggle || !status || !task || !run) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let enabled = false;
  let mode = 'wake'; // wake | command
  let restartTimer = null;
  let silenceTimer = null;
  let pendingText = '';
  let starting = false;

  const setStatus = (message) => {
    status.textContent = message;
    status.hidden = !enabled;
  };

  const normalize = (value) => String(value || '')
    .toLocaleLowerCase('ru-RU')
    .replace(/[.,!?;:()[\]{}«»"'`]/g, ' ')
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

  function startWakeMode() {
    clearSilenceTimer();
    pendingText = '';
    mode = 'wake';
    if (enabled) setStatus('Аврора ждёт имя «Аврора»…');
  }

  function finishCommand() {
    clearSilenceTimer();
    const question = pendingText.trim();
    pendingText = '';
    mode = 'wake';

    if (question) {
      // Вставляем распознанную речь в обычное поле задачи и запускаем
      // существующий обработчик Agent, не обходя его логику.
      task.value = question;
      task.dispatchEvent(new Event('input', { bubbles: true }));
      setStatus('Вопрос распознан. Передаю его агенту…');
      run.click();
      if (enabled) setStatus('Аврора ждёт имя «Аврора»…');
    } else if (enabled) {
      setStatus('Тишина 10 секунд. Аврора снова ждёт имя…');
    }
  }

  function armSilenceTimer() {
    clearSilenceTimer();
    silenceTimer = setTimeout(finishCommand, 10000);
  }

  function removeWakeWord(text) {
    // Убираем имя вызова только один раз в начале фразы.
    return String(text || '').replace(/^\s*аврора[\s,.:;!?—-]*/i, '').trim();
  }

  function handleFinalTranscript(rawText) {
    if (!enabled) return;
    const transcript = String(rawText || '').trim();
    if (!transcript) return;

    if (mode === 'wake') {
      if (!/\bаврора\b/i.test(normalize(transcript))) return;
      mode = 'command';
      pendingText = removeWakeWord(transcript);
      setStatus('Слушаю вопрос… можно говорить сколько угодно.');
      armSilenceTimer();
      return;
    }

    // Если имя повторилось во время диалога, это не должно попадать
    // в текст запроса.
    const cleaned = removeWakeWord(transcript);
    if (cleaned) pendingText = [pendingText, cleaned].filter(Boolean).join(' ').trim();
    setStatus(pendingText ? 'Слушаю… завершение после 10 секунд тишины.' : 'Слушаю вопрос…');
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
        // Chrome может ещё завершать предыдущую сессию распознавания.
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
        if (result && result.isFinal && result[0]) {
          handleFinalTranscript(result[0].transcript);
        }
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
      if (event.error === 'audio-capture') {
        setStatus('Микрофон не найден или занят другим приложением.');
      }
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
    pendingText = '';
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
    pendingText = '';
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
