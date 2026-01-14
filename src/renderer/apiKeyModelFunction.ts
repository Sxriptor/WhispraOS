/**
 * Shows the API key configuration modal
 * @param apiKeys - Object containing the current API key status
 * @param currentLanguage - Current UI language code
 * @param updateApiKeys - Callback function to update API keys
 */
export function showApiKeyModal(
    apiKeys: any,
    currentLanguage: string,
    updateApiKeys: (keys: { openai: string; elevenlabs: string }) => Promise<void>
): void {
    // Prevent multiple modals
    if (document.getElementById('api-key-modal')) return;

    // Create the modal structure
    const modal = document.createElement('div');
    modal.id = 'api-key-modal';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 12px;
        width: 520px;
        max-width: 90%;
        box-shadow: 0 20px 50px rgba(0,0,0,0.25);
    `;

    // Get current language settings translations inline
    const settingsTranslations = {
        'en': {
            modal: { title: 'Secure API Configuration', close: 'Close' },
            instructions: { title: 'API Key Setup Instructions', openaiTitle: 'OpenAI API Key', openaiPermissions: 'Read permissions: Models, Capabilities', openaiUsage: 'Used for speech-to-text and text-to-speech translation', openaiLink: 'platform.openai.com/api-keys', elevenlabsTitle: 'ElevenLabs API Key', elevenlabsRestrict: 'Restrict key: Enabled', elevenlabsNoAccess: 'Everything else: No access', elevenlabsTts: 'Text to speech: Access', elevenlabsSts: 'Speech to speech: Access', elevenlabsAgents: 'ElevenLabs agents: Write', elevenlabsVoices: 'Voices: Write', elevenlabsVoiceGen: 'Voice generation: Access', elevenlabsUser: 'User: Read', elevenlabsLink: 'elevenlabs.io/app/profile' },
            fields: { openaiLabel: 'OpenAI API Key:', openaiPlaceholder: 'Enter your OpenAI API key', openaiStored: 'Key stored securely', openaiHelp: 'Enter your OpenAI API key (sk-...)', elevenlabsLabel: 'ElevenLabs API Key:', elevenlabsPlaceholder: 'Enter your ElevenLabs API key', elevenlabsStored: 'Key stored securely', elevenlabsHelp: 'Enter your ElevenLabs API key (32 chars)' },
            buttons: { showKey: 'Show Key', removeKey: 'Remove Key', clearAll: 'Clear All Keys', cancel: 'Cancel', save: 'Save' },
            status: { keyStored: '✓ Key stored securely' },
            links: { openai: 'Generate key at: platform.openai.com/api-keys', elevenlabs: 'Generate key at: elevenlabs.io/app/profile' }
        },
        'es': {
            modal: { title: 'Configuración Segura de API', close: 'Cerrar' },
            instructions: { title: 'Instrucciones de Configuración de Claves API', openaiTitle: 'Clave API de OpenAI', openaiPermissions: 'Permisos de lectura: Modelos, Capacidades', openaiUsage: 'Usado para traducción de voz a texto y texto a voz', openaiLink: 'platform.openai.com/api-keys', elevenlabsTitle: 'Clave API de ElevenLabs', elevenlabsRestrict: 'Restringir clave: Habilitado', elevenlabsNoAccess: 'Todo lo demás: Sin acceso', elevenlabsTts: 'Texto a voz: Acceso', elevenlabsSts: 'Voz a voz: Acceso', elevenlabsAgents: 'Agentes ElevenLabs: Escritura', elevenlabsVoices: 'Voces: Escritura', elevenlabsVoiceGen: 'Generación de voz: Acceso', elevenlabsUser: 'Usuario: Lectura', elevenlabsLink: 'elevenlabs.io/app/profile' },
            fields: { openaiLabel: 'Clave API de OpenAI:', openaiPlaceholder: 'Ingresa tu clave API de OpenAI', openaiStored: 'Clave almacenada de forma segura', openaiHelp: 'Ingresa tu clave API de OpenAI (sk-...)', elevenlabsLabel: 'Clave API de ElevenLabs:', elevenlabsPlaceholder: 'Ingresa tu clave API de ElevenLabs', elevenlabsStored: 'Clave almacenada de forma segura', elevenlabsHelp: 'Ingresa tu clave API de ElevenLabs (32 caracteres)' },
            buttons: { showKey: 'Mostrar Clave', removeKey: 'Eliminar Clave', clearAll: 'Eliminar Todas las Claves', cancel: 'Cancelar', save: 'Guardar' },
            status: { keyStored: '✓ Clave almacenada de forma segura' },
            links: { openai: 'Generar clave en: platform.openai.com/api-keys', elevenlabs: 'Generar clave en: elevenlabs.io/app/profile' }
        },
        'ru': {
            modal: { title: 'Безопасная Конфигурация API', close: 'Закрыть' },
            instructions: { title: 'Инструкции по Настройке Ключей API', openaiTitle: 'Ключ API OpenAI', openaiPermissions: 'Разрешения на чтение: Модели, Возможности', openaiUsage: 'Используется для перевода речи в текст и текста в речь', openaiLink: 'platform.openai.com/api-keys', elevenlabsTitle: 'Ключ API ElevenLabs', elevenlabsRestrict: 'Ограничить ключ: Включено', elevenlabsNoAccess: 'Все остальное: Нет доступа', elevenlabsTts: 'Текст в речь: Доступ', elevenlabsSts: 'Речь в речь: Доступ', elevenlabsAgents: 'Агенты ElevenLabs: Запись', elevenlabsVoices: 'Голоса: Запись', elevenlabsVoiceGen: 'Генерация голоса: Доступ', elevenlabsUser: 'Пользователь: Чтение', elevenlabsLink: 'elevenlabs.io/app/profile' },
            fields: { openaiLabel: 'Ключ API OpenAI:', openaiPlaceholder: 'Введите ваш ключ API OpenAI', openaiStored: 'Ключ хранится безопасно', openaiHelp: 'Введите ваш ключ API OpenAI (sk-...)', elevenlabsLabel: 'Ключ API ElevenLabs:', elevenlabsPlaceholder: 'Введите ваш ключ API ElevenLabs', elevenlabsStored: 'Ключ хранится безопасно', elevenlabsHelp: 'Введите ваш ключ API ElevenLabs (32 символа)' },
            buttons: { showKey: 'Показать Ключ', removeKey: 'Удалить Ключ', clearAll: 'Удалить Все Ключи', cancel: 'Отмена', save: 'Сохранить' },
            status: { keyStored: '✓ Ключ хранится безопасно' },
            links: { openai: 'Сгенерировать ключ на: platform.openai.com/api-keys', elevenlabs: 'Сгенерировать ключ на: elevenlabs.io/app/profile' }
        },
        'zh': {
            modal: { title: '安全 API 配置', close: '关闭' },
            instructions: { title: 'API 密钥设置说明', openaiTitle: 'OpenAI API 密钥', openaiPermissions: '读取权限：模型、功能', openaiUsage: '用于语音转文本和文本转语音翻译', openaiLink: 'platform.openai.com/api-keys', elevenlabsTitle: 'ElevenLabs API 密钥', elevenlabsRestrict: '限制密钥：已启用', elevenlabsNoAccess: '其他所有内容：无访问权限', elevenlabsTts: '文本转语音：访问权限', elevenlabsSts: '语音转语音：访问权限', elevenlabsAgents: 'ElevenLabs 代理：写入', elevenlabsVoices: '语音：写入', elevenlabsVoiceGen: '语音生成：访问权限', elevenlabsUser: '用户：读取', elevenlabsLink: 'elevenlabs.io/app/profile' },
            fields: { openaiLabel: 'OpenAI API 密钥：', openaiPlaceholder: '输入您的 OpenAI API 密钥', openaiStored: '密钥已安全存储', openaiHelp: '输入您的 OpenAI API 密钥 (sk-...)', elevenlabsLabel: 'ElevenLabs API 密钥：', elevenlabsPlaceholder: '输入您的 ElevenLabs API 密钥', elevenlabsStored: '密钥已安全存储', elevenlabsHelp: '输入您的 ElevenLabs API 密钥 (32 个字符)' },
            buttons: { showKey: '显示密钥', removeKey: '删除密钥', clearAll: '清除所有密钥', cancel: '取消', save: '保存' },
            status: { keyStored: '✓ 密钥已安全存储' },
            links: { openai: '在以下位置生成密钥：platform.openai.com/api-keys', elevenlabs: '在以下位置生成密钥：elevenlabs.io/app/profile' }
        },
        'ja': {
            modal: { title: '安全な API 設定', close: '閉じる' },
            instructions: { title: 'API キー設定手順', openaiTitle: 'OpenAI API キー', openaiPermissions: '読み取り権限：モデル、機能', openaiUsage: '音声テキスト変換とテキスト音声変換の翻訳に使用', openaiLink: 'platform.openai.com/api-keys', elevenlabsTitle: 'ElevenLabs API キー', elevenlabsRestrict: 'キーを制限：有効', elevenlabsNoAccess: 'その他すべて：アクセスなし', elevenlabsTts: 'テキスト音声変換：アクセス', elevenlabsSts: '音声音声変換：アクセス', elevenlabsAgents: 'ElevenLabs エージェント：書き込み', elevenlabsVoices: '音声：書き込み', elevenlabsVoiceGen: '音声生成：アクセス', elevenlabsUser: 'ユーザー：読み取り', elevenlabsLink: 'elevenlabs.io/app/profile' },
            fields: { openaiLabel: 'OpenAI API キー：', openaiPlaceholder: 'OpenAI API キーを入力してください', openaiStored: 'キーが安全に保存されました', openaiHelp: 'OpenAI API キーを入力してください (sk-...)', elevenlabsLabel: 'ElevenLabs API キー：', elevenlabsPlaceholder: 'ElevenLabs API キーを入力してください', elevenlabsStored: 'キーが安全に保存されました', elevenlabsHelp: 'ElevenLabs API キーを入力してください (32 文字)' },
            buttons: { showKey: 'キーを表示', removeKey: 'キーを削除', clearAll: 'すべてのキーをクリア', cancel: 'キャンセル', save: '保存' },
            status: { keyStored: '✓ キーが安全に保存されました' },
            links: { openai: 'キーを生成：platform.openai.com/api-keys', elevenlabs: 'キーを生成：elevenlabs.io/app/profile' }
        }
    }[currentLanguage] || {
        'en': {
            modal: { title: 'Secure API Configuration', close: 'Close' },
            instructions: { title: 'API Key Setup Instructions', openaiTitle: 'OpenAI API Key', openaiPermissions: 'Read permissions: Models, Capabilities', openaiUsage: 'Used for speech-to-text and text-to-speech translation', openaiLink: 'platform.openai.com/api-keys', elevenlabsTitle: 'ElevenLabs API Key', elevenlabsRestrict: 'Restrict key: Enabled', elevenlabsNoAccess: 'Everything else: No access', elevenlabsTts: 'Text to speech: Access', elevenlabsSts: 'Speech to speech: Access', elevenlabsAgents: 'ElevenLabs agents: Write', elevenlabsVoices: 'Voices: Write', elevenlabsVoiceGen: 'Voice generation: Access', elevenlabsUser: 'User: Read', elevenlabsLink: 'elevenlabs.io/app/profile' },
            fields: { openaiLabel: 'OpenAI API Key:', openaiPlaceholder: 'Enter your OpenAI API key', openaiStored: 'Key stored securely', openaiHelp: 'Enter your OpenAI API key (sk-...)', elevenlabsLabel: 'ElevenLabs API Key:', elevenlabsPlaceholder: 'Enter your ElevenLabs API key', elevenlabsStored: 'Key stored securely', elevenlabsHelp: 'Enter your ElevenLabs API key (32 chars)' },
            buttons: { showKey: 'Show Key', removeKey: 'Remove Key', clearAll: 'Clear All Keys', cancel: 'Cancel', save: 'Save' },
            status: { keyStored: '✓ Key stored securely' },
            links: { openai: 'Generate key at: platform.openai.com/api-keys', elevenlabs: 'Generate key at: elevenlabs.io/app/profile' }
        }
    }['en'];

    // Create enhanced modal content with show/remove functionality
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2 style="margin: 0; color: #333;">🔐 ${settingsTranslations.modal.title}</h2>
            <button id="close-settings-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;" onmouseover="this.style.background='#f0f0f0'; this.style.color='#333';" onmouseout="this.style.background='none'; this.style.color='#666';">${settingsTranslations.modal.close}</button>
        </div>

        <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 0.75rem; margin-bottom: 1rem;">
            <h3 style="margin: 0 0 0.75rem 0; color: #495057; font-size: 0.95rem;">📋 ${settingsTranslations.instructions.title}</h3>

            <div style="margin-bottom: 0.75rem;">
                <h4 style="margin: 0 0 0.25rem 0; color: #007bff; font-size: 0.85rem;">${settingsTranslations.instructions.openaiTitle}</h4>
                <ul style="margin: 0; padding-left: 1rem; color: #6c757d; font-size: 0.8rem; line-height: 1.3;">
                    <li><strong>${settingsTranslations.instructions.openaiPermissions}</strong></li>
                    <li>${settingsTranslations.instructions.openaiUsage}</li>
                    <li>${settingsTranslations.links.openai}</li>
                </ul>
            </div>

            <div>
                <h4 style="margin: 0 0 0.25rem 0; color: #007bff; font-size: 0.85rem;">${settingsTranslations.instructions.elevenlabsTitle}</h4>
                <ul style="margin: 0; padding-left: 1rem; color: #6c757d; font-size: 0.8rem; line-height: 1.3;">
                    <li><strong>${settingsTranslations.instructions.elevenlabsRestrict}</strong></li>
                    <li><strong>${settingsTranslations.instructions.elevenlabsNoAccess}</strong></li>
                    <li><strong>${settingsTranslations.instructions.elevenlabsTts}</strong></li>
                    <li><strong>${settingsTranslations.instructions.elevenlabsSts}</strong></li>
                    <li><strong>${settingsTranslations.instructions.elevenlabsAgents}</strong></li>
                    <li><strong>${settingsTranslations.instructions.elevenlabsVoices}</strong></li>
                    <li><strong>${settingsTranslations.instructions.elevenlabsVoiceGen}</strong></li>
                    <li><strong>${settingsTranslations.instructions.elevenlabsUser}</strong></li>
                    <li>${settingsTranslations.links.elevenlabs}</li>
                </ul>
            </div>
        </div>

        <div style="margin-bottom: 1rem;">
            <label for="openai-key">${settingsTranslations.fields.openaiLabel}</label>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
                <input type="password" id="openai-key" placeholder="${apiKeys.openai === '***' ? settingsTranslations.fields.openaiStored : settingsTranslations.fields.openaiPlaceholder}" style="flex: 1; padding: 0.5rem;">
                ${apiKeys.openai === '***' ? `
                    <button id="show-openai-btn" style="padding: 0.5rem; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 14px;" title="${settingsTranslations.buttons.showKey}">🔍</button>
                    <button id="remove-openai-btn" style="padding: 0.5rem; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 14px;" title="${settingsTranslations.buttons.removeKey}">🗑️</button>
                ` : ''}
            </div>
            ${apiKeys.openai === '***' ? `<small style="color: #28a745;">${settingsTranslations.status.keyStored}</small>` : `<small style="color: #6c757d;">${settingsTranslations.fields.openaiHelp}</small>`}
        </div>
        <div style="margin-bottom: 1rem;">
            <label for="elevenlabs-key">${settingsTranslations.fields.elevenlabsLabel}</label>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
                <input type="password" id="elevenlabs-key" placeholder="${apiKeys.elevenlabs === '***' ? settingsTranslations.fields.elevenlabsStored : settingsTranslations.fields.elevenlabsPlaceholder}" style="flex: 1; padding: 0.5rem;">
                ${apiKeys.elevenlabs === '***' ? `
                    <button id="show-elevenlabs-btn" style="padding: 0.5rem; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 14px;" title="${settingsTranslations.buttons.showKey}">🔍</button>
                    <button id="remove-elevenlabs-btn" style="padding: 0.5rem; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 14px;" title="${settingsTranslations.buttons.removeKey}">🗑️</button>
                ` : ''}
            </div>
            ${apiKeys.elevenlabs === '***' ? `<small style="color: #28a745;">${settingsTranslations.status.keyStored}</small>` : `<small style="color: #6c757d;">${settingsTranslations.fields.elevenlabsHelp}</small>`}
        </div>
        <div style="display: flex; gap: 1rem; justify-content: space-between; align-items: center;">
            <button id="clear-all-btn" style="padding: 0.5rem 1rem; background: #dc3545; color: white; border: none; border-radius: 4px;">${settingsTranslations.buttons.clearAll}</button>
            <div style="display: flex; gap: 1rem;">
                <button id="cancel-btn" style="padding: 0.5rem 1rem;">${settingsTranslations.buttons.cancel}</button>
                <button id="save-btn" style="padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px;">${settingsTranslations.buttons.save}</button>
            </div>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Close modal with ESC key
    const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Show key functionality
    const handleShowKey = async (keyType: 'openai' | 'elevenlabs') => {
        try {
            const response = await (window as any).electronAPI.invoke('config:get-api-key', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: { keyType }
            });

            if (response.success && response.payload?.key) {
                const input = modalContent.querySelector(`#${keyType}-key`) as HTMLInputElement;
                if (input) {
                    input.type = 'text';
                    input.value = response.payload.key;
                    input.style.fontFamily = 'monospace';

                    // Auto-select the text for easy copying
                    input.select();

                    // Change button to hide after showing
                    const showBtn = modalContent.querySelector(`#show-${keyType}-btn`) as HTMLButtonElement;
                    if (showBtn) {
                        showBtn.textContent = '👁️';
                        showBtn.title = 'Hide Key';
                        showBtn.onclick = () => {
                            input.type = 'password';
                            input.value = '';
                            input.placeholder = 'Key stored securely';
                            input.style.fontFamily = '';
                            showBtn.textContent = '🔍';
                            showBtn.title = 'Show Key';
                            showBtn.onclick = () => handleShowKey(keyType);
                        };
                    }
                }
            } else {
                alert('Failed to retrieve API key');
            }
        } catch (error) {
            console.error('Error showing API key:', error);
            alert('Failed to show API key');
        }
    };

    // Remove single key functionality
    const handleRemoveKey = async (keyType: 'openai' | 'elevenlabs') => {
        const keyName = keyType === 'openai' ? 'OpenAI' : 'ElevenLabs';
        const confirmed = confirm(
            `⚠️ Remove ${keyName} API Key?\n\n` +
            `This will permanently delete your ${keyName} API key from secure storage.\n\n` +
            `If you don't have the key written down elsewhere, you'll need to generate a new one from ${keyName}'s website.\n\n` +
            `Are you sure you want to continue?`
        );

        if (confirmed) {
            try {
                const response = await (window as any).electronAPI.invoke('config:remove-api-key', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: { keyType }
                });

                if (response.success) {
                    // Refresh the modal to show updated state
                    modal.remove();

                    // Fetch updated keys and show modal again
                    const updatedResponse = await (window as any).electronAPI.invoke('config:get', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: null
                    });

                    if (updatedResponse.success) {
                        showApiKeyModal(updatedResponse.payload?.apiKeys || {}, currentLanguage, updateApiKeys);
                    }
                } else {
                    alert('Failed to remove API key');
                }
            } catch (error) {
                console.error('Error removing API key:', error);
                alert('Failed to remove API key');
            }
        }
    };

    // Clear all keys functionality
    const handleClearAll = async () => {
        const confirmed = confirm(
            `⚠️ DANGER: Clear ALL API Keys?\n\n` +
            `This will permanently delete ALL API keys from secure storage including:\n` +
            `• OpenAI API Key\n` +
            `• ElevenLabs API Key\n\n` +
            `If you don't have these keys written down elsewhere, you'll need to generate new ones.\n\n` +
            `This action cannot be undone. Are you absolutely sure?`
        );

        if (confirmed) {
            const doubleConfirmed = confirm(
                `🚨 FINAL WARNING 🚨\n\n` +
                `You are about to permanently delete ALL API keys.\n\n` +
                `Click OK to proceed with deletion, or Cancel to abort.`
            );

            if (doubleConfirmed) {
                try {
                    const response = await (window as any).electronAPI.invoke('config:clear-all-api-keys', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: {}
                    });

                    if (response.success) {
                        alert('✅ All API keys have been cleared from secure storage.');
                        modal.remove();

                        // Show modal again with empty state
                        showApiKeyModal({}, currentLanguage, updateApiKeys);
                    } else {
                        alert('Failed to clear API keys');
                    }
                } catch (error) {
                    console.error('Error clearing API keys:', error);
                    alert('Failed to clear API keys');
                }
            }
        }
    };

    // Event listeners for show buttons
    modalContent.querySelector('#show-openai-btn')?.addEventListener('click', () => handleShowKey('openai'));
    modalContent.querySelector('#show-elevenlabs-btn')?.addEventListener('click', () => handleShowKey('elevenlabs'));

    // Event listeners for remove buttons
    modalContent.querySelector('#remove-openai-btn')?.addEventListener('click', () => handleRemoveKey('openai'));
    modalContent.querySelector('#remove-elevenlabs-btn')?.addEventListener('click', () => handleRemoveKey('elevenlabs'));

    // Event listener for clear all button
    modalContent.querySelector('#clear-all-btn')?.addEventListener('click', handleClearAll);

    // Event listener for close button
    modalContent.querySelector('#close-settings-modal')?.addEventListener('click', () => {
        modal.remove();
    });

    // Event listeners for external links
    modalContent.querySelector('#openai-link')?.addEventListener('click', () => {
        (window as any).electronAPI.openExternal('https://platform.openai.com/api-keys');
    });

    modalContent.querySelector('#elevenlabs-link')?.addEventListener('click', () => {
        (window as any).electronAPI.openExternal('https://elevenlabs.io/app/profile');
    });

    // Handle save
    modalContent.querySelector('#save-btn')?.addEventListener('click', async () => {
        const openaiKey = (modalContent.querySelector('#openai-key') as HTMLInputElement).value;
        const elevenlabsKey = (modalContent.querySelector('#elevenlabs-key') as HTMLInputElement).value;

        await updateApiKeys({
            openai: openaiKey,
            elevenlabs: elevenlabsKey
        });

        document.body.removeChild(modal);
    });

    // Handle cancel
    modalContent.querySelector('#cancel-btn')?.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // Handle click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}