/**
 * Deploy JSON Generator - Visual Flow Editor
 * Main application logic: nodes, connections, flows, JSON generation
 */

const App = (() => {
    // ========== STATE ==========
    const SERVERS = {
        haaTeamCity: 'https://haateamcity.mbank.pl/',
        teamcity: 'https://teamcity.mbank.pl/',
        ferryt: 'https://teamcity.mbank.pl/'
    };

    const SERVER_LABELS = {
        haaTeamCity: 'haaTeamCity.mbank.pl',
        teamcity: 'TeamCity.mbank.pl',
        ferryt: 'Ferryt'
    };

    const SQL_RUNNER_BUILD_ID = 'AutomateDeploy_SqlRunner';
    const SCRIPT_RUNNER_BUILD_ID = 'AutomateDeploy_ScriptRunner';
    const RUNONLY_BUILD_ID = 'AnsiblePlaybookRunner_ProdRunPlaybookAnsible';

    // Edytuj te wartosci, jesli kolejne buildid maja moc wystepowac wielokrotnie w jednym JSON-ie.
    const DUPLICATE_ALLOWED_BUILD_IDS = [
        'AutomateDeploy_SqlRunner',
        'AutomateDeploy_ScriptRunner',
        'AnsiblePlaybookRunner_ProdRunPlaybookAnsible',
        'DEIZUKC_Ferryt_BpmProcessesMigrations_Sql_ProdDeployment',
        'DEIZUKC_Ferryt_BpmProcessesMigrations_SVAutoImport_ProdDeployment',
        'DEIZUKC_Deihaatools_Ferryt_Prod_FerrytRestartSerwisW',
        'DEIZUKC_Ferryt_BpmProcessesMigrations_RenewApplication_ProdDeployment'
    ];
    const FERRYT_RENEW_PLACEHOLDER = 'Renew';
    const FERRYT_RESTART_SERVICES_TYPE = 'Restart serwisow';
    const FERRYT_RESTART_SERVICES_LEGACY_TYPE = 'Restart serwisów';
    const FERRYT_RENEW_BUILD_ID = 'DEIZUKC_Ferryt_BpmProcessesMigrations_RenewApplication_ProdDeployment';

    const FERRYT_DEFAULTS = {
        runat: '21:00',
        email: 'hardcore@mbank.pl',
        blackout: '"1680|Ferryt","1696|BPM Service"'
    };

    const AUTO_SAVE_ROOT = 'D:\\PROD_REPO_DATA\\AutomateDeploy\\Deploys';
    const ENABLE_ACTIVITY_LOG = true;
    const APP_BASE_URL = (() => {
        const scriptTag = document.currentScript || document.querySelector('script[src$="app.js"]');
        const source = scriptTag && scriptTag.src ? scriptTag.src : window.location.href;
        return new URL('./', source).href;
    })();

    const FERRYT_BUILD_CATALOG = [
        {
            buildType: 'SQL',
            buildId: 'DEIZUKC_Ferryt_BpmProcessesMigrations_Sql_ProdDeployment',
            artifactoryFolder: 'sql',
            packageField: 'deploy_PackageName',
            fields: [
                { key: 'deploy_PackageName', label: 'deploy_PackageName', required: true, type: 'text' }
            ]
        },
        {
            buildType: 'SVAutoImport',
            buildId: 'DEIZUKC_Ferryt_BpmProcessesMigrations_SVAutoImport_ProdDeployment',
            artifactoryFolder: 'AutoImporter',
            packageField: 'ImportProcessPackageName',
            fields: [
                { key: 'ImportProcessPackageName', label: 'ImportProcessPackageName', required: true, type: 'text' }
            ]
        },
        {
            buildType: FERRYT_RESTART_SERVICES_TYPE,
            buildId: 'DEIZUKC_Deihaatools_Ferryt_Prod_FerrytRestartSerwisW',
            fields: [
                {
                    key: 'todo',
                    label: 'Akcja',
                    required: true,
                    type: 'select',
                    defaultValue: 'Restart',
                    options: [
                        { value: 'Restart', label: 'restart' },
                        { value: 'stop', label: 'stop' },
                        { value: 'start', label: 'start' }
                    ]
                }
            ]
        },
        {
            buildType: 'BPM',
            buildId: '',
            fields: []
        },
        {
            buildType: 'RenewApplication File',
            buildId: 'DEIZUKC_Ferryt_BpmProcessesMigrations_RenewApplication_ProdDeployment',
            artifactoryFolder: 'RenewApplication',
            packageField: 'RenewAppFileNameTC',
            fields: [
                { key: 'RenewAppFileNameTC', label: 'RenewAppFileNameTC', required: true, type: 'text' }
            ]
        },
        {
            buildType: 'RenewApplication SQL',
            buildId: 'DEIZUKC_Ferryt_BpmProcessesMigrations_RenewApplication_ProdDeployment',
            artifactoryFolder: 'sql',
            packageField: 'RenewAppFileNameTC',
            fields: [
                { key: 'RenewAppFileNameTC', label: 'RenewAppFileNameTC', required: true, type: 'text' }
            ]
        },
        {
            buildType: 'RenewApplication Scenario',
            buildId: 'DEIZUKC_Ferryt_BpmProcessesMigrations_RenewApplication_ProdDeployment',
            fields: [
                { key: 'RenewAppFileNameTC', label: 'RenewAppFileNameTC', required: true, type: 'text' }
            ]
        }
    ];

    const FERRYT_RENEW_TYPES = [
        'RenewApplication File',
        'RenewApplication SQL',
        'RenewApplication Scenario'
    ];

    const FERRYT_TOOLBAR_ITEMS = [
        { label: 'SQL', buildType: 'SQL' },
        { label: 'SVAutoImport', buildType: 'SVAutoImport' },
        { label: FERRYT_RESTART_SERVICES_TYPE, buildType: FERRYT_RESTART_SERVICES_TYPE },
        { label: 'BPM', buildType: 'BPM' },
        { label: 'Renew', buildType: FERRYT_RENEW_PLACEHOLDER }
    ];

    let state = {
        currentServer: 'haaTeamCity',
        currentFlowId: null,
        flows: {},
        flowOrder: [],
        nodeCounter: 0,
        exportDate: '',
        editingNodeId: null,
        pendingNewNodeId: null,
        dragging: null,
        connecting: null
    };

    let currentUsername = '';
    let editingFerrytType = '';
    let loggingDisabled = false;

    function buildAppUrl(path) {
        return new URL(path, APP_BASE_URL).toString();
    }

    function getTodayIsoDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function sanitizeWindowsFileName(value) {
        return (value || '')
            .trim()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    }

    function stripJsonExtension(value) {
        return String(value || '').trim().replace(/\.json$/i, '');
    }

    function getSafeDeployFilenameBase(value) {
        return sanitizeWindowsFileName(stripJsonExtension(value)) || 'deploy';
    }

    function parseDelimitedNames(value) {
        if (Array.isArray(value)) {
            return value.reduce((result, item) => result.concat(parseDelimitedNames(item)), []);
        }
        if (typeof value !== 'string') return [];
        return [...new Set(value
            .split(',')
            .map(item => stripJsonExtension(item).trim())
            .filter(Boolean))];
    }

    function getNodeWaitforList(node) {
        if (!node) return [];
        return parseDelimitedNames(node.waitfor);
    }

    function setNodeWaitforList(node, names) {
        if (!node) return;
        const normalizedNames = parseDelimitedNames(names);
        node.waitfor = normalizedNames.join(', ');
    }

    function addNodeWaitfor(node, dependencyName) {
        if (!node) return;
        const normalizedDependency = stripJsonExtension(dependencyName).trim();
        if (!normalizedDependency) return;
        const dependencies = getNodeWaitforList(node);
        if (dependencies.includes(normalizedDependency)) return;
        dependencies.push(normalizedDependency);
        setNodeWaitforList(node, dependencies);
    }

    function removeNodeWaitfor(node, dependencyName) {
        if (!node) return;
        const normalizedDependency = stripJsonExtension(dependencyName).trim();
        if (!normalizedDependency) return;
        setNodeWaitforList(
            node,
            getNodeWaitforList(node).filter(name => name !== normalizedDependency)
        );
    }

    function replaceNodeWaitfor(node, oldDependencyName, newDependencyName) {
        if (!node) return;
        const oldName = stripJsonExtension(oldDependencyName).trim();
        const newName = stripJsonExtension(newDependencyName).trim();
        if (!oldName || !newName) return;
        setNodeWaitforList(
            node,
            getNodeWaitforList(node).map(name => name === oldName ? newName : name)
        );
    }

    function normalizeJsonFileContent(value) {
        return String(value || '')
            .replace(/^\uFEFF/, '')
            .trim();
    }

    function getObjectValueCaseInsensitive(obj, keys) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
        const normalizedKeys = Array.isArray(keys) ? keys.map(key => String(key).toLowerCase()) : [String(keys).toLowerCase()];
        const entries = Object.entries(obj);

        for (const normalizedKey of normalizedKeys) {
            const matchedEntry = entries.find(([key]) => String(key).toLowerCase() === normalizedKey);
            if (matchedEntry) {
                return matchedEntry[1];
            }
        }

        return undefined;
    }

    function stripJsonLikeComments(value) {
        const input = String(value || '');
        let output = '';
        let inString = false;
        let escaped = false;
        let inLineComment = false;
        let inBlockComment = false;

        for (let i = 0; i < input.length; i++) {
            const currentChar = input[i];
            const nextChar = input[i + 1];

            if (inLineComment) {
                if (currentChar === '\n' || currentChar === '\r') {
                    inLineComment = false;
                    output += currentChar;
                }
                continue;
            }

            if (inBlockComment) {
                if (currentChar === '*' && nextChar === '/') {
                    inBlockComment = false;
                    i++;
                }
                continue;
            }

            if (inString) {
                output += currentChar;
                if (escaped) {
                    escaped = false;
                } else if (currentChar === '\\') {
                    escaped = true;
                } else if (currentChar === '"') {
                    inString = false;
                }
                continue;
            }

            if (currentChar === '"') {
                inString = true;
                output += currentChar;
                continue;
            }

            if (currentChar === '/' && nextChar === '/') {
                inLineComment = true;
                i++;
                continue;
            }

            if (currentChar === '/' && nextChar === '*') {
                inBlockComment = true;
                i++;
                continue;
            }

            output += currentChar;
        }

        return output;
    }

    function stripJsonTrailingCommas(value) {
        const input = String(value || '');
        let output = '';
        let inString = false;
        let escaped = false;

        for (let i = 0; i < input.length; i++) {
            const currentChar = input[i];

            if (inString) {
                output += currentChar;
                if (escaped) {
                    escaped = false;
                } else if (currentChar === '\\') {
                    escaped = true;
                } else if (currentChar === '"') {
                    inString = false;
                }
                continue;
            }

            if (currentChar === '"') {
                inString = true;
                output += currentChar;
                continue;
            }

            if (currentChar === ',') {
                let nextIndex = i + 1;
                while (nextIndex < input.length && /\s/.test(input[nextIndex])) {
                    nextIndex++;
                }

                if (input[nextIndex] === '}' || input[nextIndex] === ']') {
                    continue;
                }
            }

            output += currentChar;
        }

        return output;
    }

    function sanitizeJsonLikeContent(value) {
        return stripJsonTrailingCommas(stripJsonLikeComments(value));
    }

    function looksLikeDeployJsonObject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        return ['tcserver', 'builds', 'bilds', 'runat', 'waitfor', 'enabled', 'email', 'change']
            .some(key => getObjectValueCaseInsensitive(value, [key]) !== undefined);
    }

    function unwrapDeployJsonRoot(value) {
        if (Array.isArray(value)) {
            if (value.length !== 1) return null;
            return unwrapDeployJsonRoot(value[0]);
        }

        if (!value || typeof value !== 'object') return null;
        if (looksLikeDeployJsonObject(value)) return value;

        const nestedCandidate = getObjectValueCaseInsensitive(value, ['deploy', 'data', 'payload', 'item', 'json']);
        if (nestedCandidate && nestedCandidate !== value) {
            const unwrappedNestedCandidate = unwrapDeployJsonRoot(nestedCandidate);
            if (unwrappedNestedCandidate) {
                return unwrappedNestedCandidate;
            }
        }

        return value;
    }

    function parseDeployJsonContent(value) {
        const normalizedContent = normalizeJsonFileContent(value);
        if (!normalizedContent) return null;

        const candidates = [normalizedContent];
        const sanitizedContent = sanitizeJsonLikeContent(normalizedContent);
        if (sanitizedContent && sanitizedContent !== normalizedContent) {
            candidates.push(sanitizedContent);
        }

        for (const candidate of candidates) {
            try {
                const parsed = JSON.parse(candidate);
                const unwrapped = unwrapDeployJsonRoot(parsed);
                if (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)) {
                    return unwrapped;
                }
            } catch (error) {
                // Try the next relaxed variant.
            }
        }

        return null;
    }

    function normalizeFlag(value, fallback = 1) {
        if (value === true) return 1;
        if (value === false) return 0;
        if (value === 0 || value === '0') return 0;
        if (value === 1 || value === '1') return 1;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true' || normalized === 'yes') return 1;
            if (normalized === 'false' || normalized === 'no') return 0;
        }
        return fallback;
    }

    function formatBlackoutForInput(value) {
        if (Array.isArray(value)) {
            return value
                .map(item => String(item || '').trim())
                .filter(Boolean)
                .map(item => `"${item.replace(/^"(.*)"$/, '$1')}"`)
                .join(',');
        }

        const text = String(value || '').trim().replace(/^"(.*)"$/, '$1');
        return text ? `"${text}"` : '';
    }

    function formatSmsForInput(value) {
        if (Array.isArray(value)) {
            return value
                .map(item => String(item || '').trim().replace(/^"(.*)"$/, '$1'))
                .filter(Boolean)
                .join(',');
        }

        return String(value || '').trim().replace(/^"(.*)"$/, '$1');
    }

    function syncFerrytFilename(flow) {
        if (!flow || !isFerrytServer(flow.server)) return;
        flow.filename = `Ferryt_${sanitizeWindowsFileName(flow.change || '')}`;
    }

    function stringifyLogDetails(details) {
        if (details === null || details === undefined) return '';
        if (typeof details === 'string') return details.slice(0, 4000);

        try {
            return JSON.stringify(details).slice(0, 4000);
        } catch (error) {
            return String(details).slice(0, 4000);
        }
    }

    function logEvent(eventType, details = '') {
        if (!ENABLE_ACTIVITY_LOG) return;
        if (loggingDisabled) return;
        try {
            const payload = new URLSearchParams({
                server: state.currentServer || '',
                eventType: eventType || 'UNKNOWN',
                event: eventType || 'UNKNOWN',
                action: eventType || 'UNKNOWN',
                data: stringifyLogDetails(details)
            }).toString();

            fetch(buildAppUrl('activity-log.aspx'), {
                method: 'POST',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                credentials: 'same-origin',
                body: payload
            }).then(response => {
                if (!response.ok) {
                    loggingDisabled = true;
                }
            }).catch(() => {
                loggingDisabled = true;
            });
        } catch (error) {
            // Ignore logging failures so they never affect the UI flow.
        }
    }

    function getStorageKey() {
        return currentUsername
            ? 'deployJsonGenerator_' + currentUsername
            : 'deployJsonGenerator';
    }

    function isFerrytServer(server = state.currentServer) {
        return server === 'ferryt';
    }

    function normalizeFerrytBuildType(buildType) {
        return buildType === FERRYT_RESTART_SERVICES_LEGACY_TYPE
            ? FERRYT_RESTART_SERVICES_TYPE
            : (buildType || '');
    }

    function normalizeFerrytNodeName(name, ferrytType) {
        if (
            normalizeFerrytBuildType(ferrytType) === FERRYT_RESTART_SERVICES_TYPE &&
            String(name || '').trim() === FERRYT_RESTART_SERVICES_LEGACY_TYPE
        ) {
            return FERRYT_RESTART_SERVICES_TYPE;
        }

        return String(name || '').trim();
    }

    function getFerrytCatalogItem(buildType) {
        const normalizedBuildType = normalizeFerrytBuildType(buildType);
        return FERRYT_BUILD_CATALOG.find(item => item.buildType === normalizedBuildType) || null;
    }

    function isFerrytRenewType(buildType) {
        return buildType === FERRYT_RENEW_PLACEHOLDER || FERRYT_RENEW_TYPES.includes(buildType);
    }

    function getFerrytEffectiveType(buildType = editingFerrytType) {
        if (!isFerrytRenewType(buildType)) {
            return normalizeFerrytBuildType(buildType);
        }

        return FERRYT_RENEW_TYPES.includes(editingFerrytType) ? editingFerrytType : '';
    }

    function applyFerrytFlowDefaults(flow) {
        if (!flow || !isFerrytServer(flow.server)) return;
        flow.runat = flow.runat || FERRYT_DEFAULTS.runat;
        flow.email = flow.email || FERRYT_DEFAULTS.email;
        flow.blackout = flow.blackout || FERRYT_DEFAULTS.blackout;
        syncFerrytFilename(flow);
    }

    function applyFerrytAutoParams(buildType, params = {}) {
        const effectiveType = FERRYT_RENEW_TYPES.includes(buildType) ? buildType : '';
        const nextParams = sanitizeParams({ ...(params || {}) });

        delete nextParams.RenewAppTC;
        delete nextParams.RenewAppSQLTC;

        if (effectiveType === 'RenewApplication File') {
            nextParams.RenewAppTC = '1';
        } else if (effectiveType === 'RenewApplication SQL') {
            nextParams.RenewAppSQLTC = '1';
        }

        return nextParams;
    }

    function normalizeFerrytNode(node) {
        if (!node) return;

        const params = sanitizeParams({ ...(node.params || {}) });
        let ferrytType = normalizeFerrytBuildType(node.ferrytType || '');

        if (params.buildPropertyName) {
            const dynamicKey = params.buildPropertyName;
            if (params.buildPropertyValue) {
                params[dynamicKey] = params.buildPropertyValue;
            }
            delete params.buildPropertyName;
            delete params.buildPropertyValue;
        }

        if (params.renewAppTC) {
            if (params.renewAppTC === 'RenewAppSQLTC' && !params.RenewAppSQLTC) {
                params.RenewAppSQLTC = params.renewAppTC;
            } else if (!params.RenewAppTC) {
                params.RenewAppTC = params.renewAppTC;
            }
            delete params.renewAppTC;
        }

        if (!ferrytType) {
            if ('deploy_PackageName' in params) {
                ferrytType = 'SQL';
            } else if ('ImportProcessPackageName' in params) {
                ferrytType = 'SVAutoImport';
            } else if ('todo' in params || node.buildid === 'DEIZUKC_Deihaatools_Ferryt_Prod_FerrytRestartSerwisW') {
                ferrytType = FERRYT_RESTART_SERVICES_TYPE;
            } else if ('RenewAppFileNameTC' in params && 'RenewAppSQLTC' in params) {
                ferrytType = 'RenewApplication SQL';
            } else if ('RenewAppFileNameTC' in params && 'RenewAppTC' in params) {
                ferrytType = 'RenewApplication File';
            } else if ('RenewAppFileNameTC' in params) {
                ferrytType = 'RenewApplication Scenario';
            } else if (!node.buildid) {
                ferrytType = 'BPM';
            }
        }

        node.ferrytType = ferrytType;
        const normalizedParams = applyFerrytAutoParams(ferrytType, params);
        if (Object.keys(normalizedParams).length > 0) {
            node.params = normalizedParams;
        } else {
            delete node.params;
        }
    }

    // ========== TIME OPTIONS (runat) ==========

    function generateTimeOptions() {
        const options = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 5) {
                const hh = String(h).padStart(2, '0');
                const mm = String(m).padStart(2, '0');
                options.push(`${hh}:${mm}`);
            }
        }
        return options;
    }

    function populateRunatSelect() {
        const select = document.getElementById('flowRunat');
        if (select.options.length > 1) return; // already populated
        const times = generateTimeOptions();
        times.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            select.appendChild(opt);
        });
    }

    // ========== FLOW MANAGEMENT ==========

    function generateFlowId() {
        return 'flow_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function createFlowModel(server = state.currentServer, overrides = {}) {
        const ferryt = isFerrytServer(server);
        const flow = {
            id: overrides.id || generateFlowId(),
            filename: ferryt ? 'Ferryt_' : 'deploy_' + (state.flowOrder.length + 1),
            savedFilename: '',
            server,
            enabled: 1,
            runat: ferryt ? FERRYT_DEFAULTS.runat : '18:00',
            email: ferryt ? FERRYT_DEFAULTS.email : '',
            blackout: ferryt ? FERRYT_DEFAULTS.blackout : '',
            sms: '',
            change: '',
            nodes: {},
            connections: [],
            interflowWaitfor: []
        };

        Object.assign(flow, overrides);
        flow.server = server;
        flow.savedFilename = stripJsonExtension(flow.savedFilename || '');
        flow.nodes = overrides.nodes || {};
        flow.connections = Array.isArray(overrides.connections) ? overrides.connections : [];
        flow.interflowWaitfor = Array.isArray(overrides.interflowWaitfor) ? overrides.interflowWaitfor : [];
        applyFerrytFlowDefaults(flow);
        return flow;
    }

    function addFlow() {
        const flow = createFlowModel(state.currentServer);
        const id = flow.id;
        state.flows[id] = flow;
        state.flowOrder.push(id);
        state.currentFlowId = id;
        renderFlowTabs();
        renderCurrentFlow();
        updateFlowCount();
        updateJsonPreview();
        renderInterflowDeps();
        renderAllFilesList();
        logEvent('FLOW_ADD', { flowId: id, filename: flow.filename, server: state.currentServer });
        return id;
    }

    function closeAllFlows() {
        const serverFlows = getServerFlows();
        if (serverFlows.length === 0) return;
        if (!confirm('Zamknac wszystkie pliki JSON dla biezacego serwera? Dane zostana usuniete.')) return;
        const serverFlowIds = new Set(serverFlows.map(f => f.id));
        // Remove flows belonging to current server
        serverFlowIds.forEach(id => {
            delete state.flows[id];
        });
        state.flowOrder = state.flowOrder.filter(id => !serverFlowIds.has(id));
        Object.values(state.flows).forEach(flow => {
            if (Array.isArray(flow.interflowWaitfor)) {
                flow.interflowWaitfor = flow.interflowWaitfor.filter(id => !serverFlowIds.has(id));
            }
        });
        // Create one fresh flow
        logEvent('FLOW_CLOSE_ALL', { server: state.currentServer, count: serverFlows.length });
        addFlow();
        showToast('Zamknieto wszystkie pliki JSON', 'success');
    }

    function removeFlow(flowId) {
        if (state.flowOrder.length <= 1) {
            showToast('Nie można usunąć ostatniego flow', 'error');
            return;
        }
        if (!confirm('Usunac ten plik JSON?')) return;
        const removedFlow = state.flows[flowId];
        delete state.flows[flowId];
        state.flowOrder = state.flowOrder.filter(id => id !== flowId);
        Object.values(state.flows).forEach(flow => {
            if (Array.isArray(flow.interflowWaitfor)) {
                flow.interflowWaitfor = flow.interflowWaitfor.filter(id => id !== flowId);
            }
        });
        if (state.currentFlowId === flowId) {
            state.currentFlowId = null;
        }
        renderFlowTabs();
        renderCurrentFlow();
        updateFlowCount();
        updateJsonPreview();
        renderInterflowDeps();
        renderAllFilesList();
        logEvent('FLOW_REMOVE', {
            flowId,
            filename: removedFlow ? removedFlow.filename : '',
            server: state.currentServer
        });
    }

    function switchFlow(flowId) {
        state.currentFlowId = flowId;
        renderFlowTabs();
        renderCurrentFlow();
        updateJsonPreview();
        const flow = state.flows[flowId];
        logEvent('FLOW_SWITCH', { flowId, filename: flow ? flow.filename : '' });
    }

    function ensureCurrentServerFlow() {
        const serverFlows = getServerFlows();
        if (serverFlows.length > 0) {
            if (!serverFlows.find(f => f.id === state.currentFlowId)) {
                state.currentFlowId = serverFlows[0].id;
            }
            return state.currentFlowId;
        }

        return addFlow();
    }

    function syncServerTabs() {
        document.querySelectorAll('.server-tabs-container .tab').forEach(tab => {
            const server = tab.dataset.server;
            const baseLabel = SERVER_LABELS[server] || server || '';
            const count = getServerFlowCount(server);
            tab.classList.toggle('active', server === state.currentServer);
            tab.textContent = `${baseLabel} (${count})`;
        });
    }

    function switchServer(server) {
        state.currentServer = server;
        syncServerTabs();
        ensureCurrentServerFlow();
        updateServerSpecificUI();
        renderFlowTabs();
        renderCurrentFlow();
        updateFlowCount();
        updateJsonPreview();
        renderInterflowDeps();
        renderAllFilesList();
        logEvent('SERVER_SWITCH', server);
    }

    function getCurrentFlow() {
        const flow = state.flows[state.currentFlowId];
        if (!flow || flow.server !== state.currentServer) return null;
        return flow;
    }

    function getServerFlowCount(server) {
        return state.flowOrder
            .map(id => state.flows[id])
            .filter(flow => flow && flow.server === server)
            .length;
    }

    function getAllFlowCount() {
        return state.flowOrder
            .map(id => state.flows[id])
            .filter(Boolean)
            .length;
    }

    function getServerFlows() {
        return state.flowOrder
            .map(id => state.flows[id])
            .filter(f => f && f.server === state.currentServer);
    }

    // ========== FLOW SETTINGS ==========

    function updateFlowSetting(key, value) {
        const flow = getCurrentFlow();
        if (!flow) return;
        flow[key] = value;
        applyFerrytFlowDefaults(flow);
        if (key === 'filename' || key === 'change') {
            renderFlowTabs();
            renderInterflowDeps();
        }
        updateJsonPreview();
        renderAllFilesList();
        logEvent('FLOW_SETTING_UPDATE', {
            flowId: flow.id,
            filename: flow.filename || '',
            key,
            value
        });
    }

    function loadFlowSettings() {
        const flow = getCurrentFlow();
        const filenameInput = document.getElementById('flowFilename');
        populateRunatSelect();
        if (!flow) {
            filenameInput.value = '';
            filenameInput.readOnly = false;
            filenameInput.title = '';
            document.getElementById('flowRunat').value = '';
            document.getElementById('flowWaitfor').value = '';
            document.getElementById('flowEmail').value = '';
            document.getElementById('flowBlackout').value = '';
            document.getElementById('flowSms').value = '';
            document.getElementById('flowChange').value = '';
            document.getElementById('flowEnabled').value = '1';
            return;
        }
        applyFerrytFlowDefaults(flow);
        filenameInput.value = flow.filename || '';
        filenameInput.readOnly = isFerrytServer(flow.server);
        filenameInput.title = isFerrytServer(flow.server)
            ? 'Dla Ferryt nazwa pliku jest budowana automatycznie z pola change.'
            : '';
        document.getElementById('flowRunat').value = flow.runat || '';
        document.getElementById('flowWaitfor').value = getInterflowWaitforNames(flow).join(', ') || '';
        document.getElementById('flowEmail').value = flow.email || '';
        document.getElementById('flowBlackout').value = flow.blackout || '';
        document.getElementById('flowSms').value = flow.sms || '';
        document.getElementById('flowChange').value = flow.change || '';
        document.getElementById('flowEnabled').value = flow.enabled;
    }

    function getInterflowWaitforNames(flow) {
        if (!Array.isArray(flow.interflowWaitfor)) return [];
        return flow.interflowWaitfor
            .map(id => state.flows[id])
            .filter(candidate => candidate && candidate.server === flow.server)
            .map(candidate => candidate.filename);
    }

    // ========== TC BUILD PARAMS ==========

    const TC_BUILD_PARAMS = {
        [SQL_RUNNER_BUILD_ID]: ['sqlserver', 'database', 'file'],
        [SCRIPT_RUNNER_BUILD_ID]: ['servers', 'file']
    };

    function isSqlRunnerType(runnerType) {
        return runnerType === 'sql';
    }

    function isScriptRunnerType(runnerType) {
        return runnerType === 'script';
    }

    function isTcSql(buildId) {
        return buildId && buildId.toLowerCase() === SQL_RUNNER_BUILD_ID.toLowerCase();
    }

    function isTcPowerShell(buildId) {
        return buildId && buildId.toLowerCase() === SCRIPT_RUNNER_BUILD_ID.toLowerCase();
    }

    function isRunOnlyType(runnerType) {
        return runnerType === 'runonly';
    }

    function allowsDuplicateBuildId(buildId) {
        return DUPLICATE_ALLOWED_BUILD_IDS.some(allowedId =>
            buildId && buildId.toLowerCase() === allowedId.toLowerCase()
        );
    }

    function isTcRunOnly(buildId) {
        return buildId && buildId.toLowerCase() === RUNONLY_BUILD_ID.toLowerCase();
    }

    function sanitizeParams(params = {}) {
        return Object.entries(params).reduce((result, [key, value]) => {
            if (value === null || value === undefined) {
                return result;
            }

            if (typeof value === 'string') {
                const trimmedValue = value.trim();
                if (!trimmedValue) {
                    return result;
                }
                result[key] = trimmedValue;
                return result;
            }

            result[key] = value;
            return result;
        }, {});
    }

    function getTcParamsFromModal(node) {
        let fields = null;

        if (isSqlRunnerType(node.runnerType) || isTcSql(node.buildid)) {
            fields = [
                { key: 'sqlserver', label: 'sqlserver', inputId: 'nodeEditSqlServer' },
                { key: 'database', label: 'database', inputId: 'nodeEditDatabase' },
                { key: 'file', label: 'file', inputId: 'nodeEditSqlFile' }
            ];
        } else if (isScriptRunnerType(node.runnerType) || isTcPowerShell(node.buildid)) {
            fields = [
                { key: 'servers', label: 'servers', inputId: 'nodeEditPsServers' },
                { key: 'file', label: 'file', inputId: 'nodeEditPsFile' }
            ];
        } else if (isRunOnlyType(node.runnerType) || isTcRunOnly(node.buildid)) {
            fields = [
                { key: 'inventory_path', label: 'inventory_path', inputId: 'nodeEditRunOnlyInventory' },
                { key: 'git.envbook.repo.branch', label: 'git.envbook.repo.branch', inputId: 'nodeEditRunOnlyBranch' },
                { key: 'playbook_path', label: 'playbook_path', inputId: 'nodeEditRunOnlyPlaybook' }
            ];
        }

        if (!fields) {
            return { params: null, missingFieldId: null, missingLabel: null };
        }

        const params = {};
        for (const field of fields) {
            const value = document.getElementById(field.inputId).value.trim();
            if (!value) {
                return { params: null, missingFieldId: field.inputId, missingLabel: field.label };
            }
            params[field.key] = value;
        }

        return { params, missingFieldId: null, missingLabel: null };
    }

    function nodeRequiresCompletedParams(node) {
        if (!node) return false;

        if (
            isSqlRunnerType(node.runnerType) ||
            isTcSql(node.buildid) ||
            isScriptRunnerType(node.runnerType) ||
            isTcPowerShell(node.buildid) ||
            isRunOnlyType(node.runnerType) ||
            isTcRunOnly(node.buildid)
        ) {
            return true;
        }

        const ferrytType = node.ferrytType || '';
        if (!isFerrytServer() || !ferrytType) {
            return false;
        }

        if (isFerrytRenewType(ferrytType)) {
            return true;
        }

        const item = getFerrytCatalogItem(ferrytType);
        return !!(item && item.fields && item.fields.some(field => field.required));
    }

    function updateTcParamsVisibility(buildId, runnerType = '') {
        const sqlSection = document.getElementById('tcSqlParams');
        const psSection = document.getElementById('tcPowerShellParams');
        const runOnlySection = document.getElementById('tcRunOnlyParams');
        sqlSection.style.display = (isSqlRunnerType(runnerType) || isTcSql(buildId)) ? '' : 'none';
        psSection.style.display = (isScriptRunnerType(runnerType) || isTcPowerShell(buildId)) ? '' : 'none';
        if (runOnlySection) runOnlySection.style.display = (isRunOnlyType(runnerType) || isTcRunOnly(buildId)) ? '' : 'none';
    }

    function loadTcParams(node) {
        const params = sanitizeParams(node.params || {});
        // AutomateDeploy_SqlRunner fields
        document.getElementById('nodeEditSqlServer').value = params.sqlserver || '';
        document.getElementById('nodeEditDatabase').value = params.database || '';
        document.getElementById('nodeEditSqlFile').value = params.file || '';
        // AutomateDeploy_ScriptRunner fields
        document.getElementById('nodeEditPsServers').value = params.servers || '';
        document.getElementById('nodeEditPsFile').value = params.file || '';
        // AnsiblePlaybookRunner_ProdRunPlaybookAnsible fields
        document.getElementById('nodeEditRunOnlyInventory').value = params.inventory_path || '';
        document.getElementById('nodeEditRunOnlyBranch').value = params['git.envbook.repo.branch'] || '';
        document.getElementById('nodeEditRunOnlyPlaybook').value = params.playbook_path || '';
    }

    function saveTcParams(node, paramsOverride = null) {
        const tcParams = paramsOverride || getTcParamsFromModal(node).params;
        if (tcParams && Object.keys(tcParams).length > 0) {
            node.params = sanitizeParams(tcParams);
        } else {
            delete node.params;
        }
    }

    function renderFerrytParamsFields(buildType, params = {}) {
        const section = document.getElementById('ferrytParams');
        const container = document.getElementById('ferrytParamsFields');
        const renewTypeGroup = document.getElementById('ferrytRenewTypeGroup');
        const renewTypeSelect = document.getElementById('nodeEditFerrytRenewType');
        if (!section || !container || !renewTypeGroup || !renewTypeSelect) return;

        const effectiveType = getFerrytEffectiveType(buildType);
        const item = getFerrytCatalogItem(effectiveType);
        if (!isFerrytServer() || (!item && !isFerrytRenewType(buildType))) {
            section.style.display = 'none';
            renewTypeGroup.style.display = 'none';
            renewTypeSelect.value = '';
            container.innerHTML = '';
            return;
        }

        section.style.display = '';
        if (isFerrytRenewType(buildType)) {
            renewTypeGroup.style.display = '';
            renewTypeSelect.value = effectiveType || '';
        } else {
            renewTypeGroup.style.display = 'none';
            renewTypeSelect.value = '';
        }

        if (!item || item.fields.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = item.fields.map(field => {
            const inputId = `nodeEditFerryt_${field.key}`;
            const currentValue = params[field.key] || field.defaultValue || '';

            if (field.type === 'select') {
                const options = field.options.map(option => {
                    const selected = currentValue === option.value ? 'selected' : '';
                    return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(option.label)}</option>`;
                }).join('');

                return `
                    <div class="form-group">
                        <label>${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
                        <select id="${inputId}">
                            ${options}
                        </select>
                    </div>
                `;
            }

            return `
                <div class="form-group">
                    <label>${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
                    <input type="text" id="${inputId}" value="${escapeHtml(currentValue)}" placeholder="${escapeHtml(field.label)}">
                </div>
            `;
        }).join('');
    }

    function getFerrytParamsFromModal(buildType) {
        const item = getFerrytCatalogItem(getFerrytEffectiveType(buildType));
        return getFerrytParamsFromInputs(item, field => document.getElementById(`nodeEditFerryt_${field.key}`));
    }

    // ========== VALIDATORS ==========

    function validateNodeName(flow, name, excludeNodeId) {
        const duplicate = Object.values(flow.nodes).find(
            n => n.name === name && n.id !== excludeNodeId
        );
        return duplicate ? `Nazwa "${name}" już istnieje w tym flow` : null;
    }

    function validateBuildId(flow, buildid, excludeNodeId, allowDuplicate = false) {
        if (!buildid) return null; // empty is allowed (placeholder used)
        if (isFerrytServer(flow.server)) return null;
        if (allowDuplicate) return null;
        if (allowsDuplicateBuildId(buildid)) return null;
        const duplicate = Object.values(flow.nodes).find(
            n => n.buildid === buildid && n.id !== excludeNodeId
        );
        return duplicate ? `buildid "${buildid}" jest już używane przez "${duplicate.name}"` : null;
    }

    // ========== NODE MANAGEMENT ==========

    function getNextNodePosition(flow, offset = 0) {
        const existingCount = Object.keys(flow.nodes).length;
        const canvas = document.getElementById('canvas');
        const canvasW = canvas.offsetWidth || 600;
        const nodeW = 180;
        return {
            x: Math.max(30, (canvasW - nodeW) / 2),
            y: 30 + (existingCount + offset) * 110
        };
    }

    function getUniqueNodeName(flow, baseName) {
        const existingNames = new Set(Object.values(flow.nodes).map(n => n.name));
        let finalName = baseName;
        let counter = 2;
        while (existingNames.has(finalName)) {
            finalName = `${baseName}_${counter}`;
            counter++;
        }
        return finalName;
    }

    function addNodeWithConfig(config = {}) {
        let flow = getCurrentFlow();
        if (!flow) {
            ensureCurrentServerFlow();
            flow = getCurrentFlow();
        }
        if (!flow) return null;

        state.nodeCounter++;
        const nodeId = 'node_' + state.nodeCounter;
        const position = getNextNodePosition(flow);

        flow.nodes[nodeId] = {
            id: nodeId,
            name: config.name || ('Build_' + state.nodeCounter),
            buildid: config.buildid || '',
            enabled: config.enabled ?? 1,
            waitfor: '',
            retry: !isFerrytServer(flow.server) ? (config.retry ?? '1') : '',
            external: !isFerrytServer(flow.server) ? (config.external || '') : '',
            stop: config.stop || '',
            ferrytType: config.ferrytType || '',
            runnerType: config.runnerType || '',
            x: position.x,
            y: position.y,
            params: config.params && Object.keys(sanitizeParams(config.params)).length > 0 ? sanitizeParams(config.params) : undefined
        };
        setNodeWaitforList(flow.nodes[nodeId], config.waitfor || []);

        renderCanvas();
        updateJsonPreview();
        expandCanvasIfNeeded();
        renderFerrytToolbarButtons();
        return nodeId;
    }

    function addNode() {
        const nodeId = addNodeWithConfig();
        if (!nodeId) return;
        const flow = getCurrentFlow();
        const node = flow && flow.nodes ? flow.nodes[nodeId] : null;
        logEvent('NODE_ADD', {
            nodeId,
            name: node ? node.name : '',
            buildid: node ? node.buildid : ''
        });
    }

    function addRunnerNode(buildId, baseName, runnerType) {
        const flow = getCurrentFlow();
        if (!flow) return;

        const nodeId = addNodeWithConfig({
            name: getUniqueNodeName(flow, baseName),
            buildid: buildId,
            runnerType
        });

        if (nodeId) {
            state.pendingNewNodeId = nodeId;
            openNodeModal(nodeId);
            logEvent('RUNNER_ADD', { nodeId, runnerType, buildId });
        }
    }

    function discardPendingNode(nodeId) {
        const flow = getCurrentFlow();
        if (!flow || !nodeId || !flow.nodes[nodeId]) return;

        const deletedName = flow.nodes[nodeId].name;
        flow.connections = flow.connections.filter(
            c => c.from !== nodeId && c.to !== nodeId
        );
        Object.values(flow.nodes).forEach(n => {
            removeNodeWaitfor(n, deletedName);
        });
        delete flow.nodes[nodeId];
        renderCanvas();
        updateJsonPreview();
        renderFerrytToolbarButtons();
        saveState();
    }

    function addSqlRunner() {
        if (state.currentServer !== 'haaTeamCity') return;
        addRunnerNode(SQL_RUNNER_BUILD_ID, 'SQLRunner', 'sql');
    }

    function addScriptRunner() {
        if (state.currentServer !== 'haaTeamCity') return;
        addRunnerNode(SCRIPT_RUNNER_BUILD_ID, 'ScriptRunner', 'script');
    }

    function addRunOnlyRunner() {
        if (state.currentServer !== 'haaTeamCity') return;
        addRunnerNode(RUNONLY_BUILD_ID, 'RunOnly', 'runonly');
    }

    function deleteNode() {
        const flow = getCurrentFlow();
        if (!flow || !state.editingNodeId) return;
        const nodeId = state.editingNodeId;
        const deletedName = flow.nodes[nodeId].name;
        const deletedBuildId = flow.nodes[nodeId].buildid || '';
        // Remove connections involving this node
        flow.connections = flow.connections.filter(
            c => c.from !== nodeId && c.to !== nodeId
        );
        // Update waitfor references
        Object.values(flow.nodes).forEach(n => {
            removeNodeWaitfor(n, deletedName);
        });
        delete flow.nodes[nodeId];
        closeNodeModal();
        renderCanvas();
        updateJsonPreview();
        renderFerrytToolbarButtons();
        logEvent('NODE_DELETE', { nodeId, name: deletedName, buildid: deletedBuildId });
    }

    // ========== CANVAS RENDERING ==========

    function renderCanvas() {
        const flow = getCurrentFlow();
        const canvas = document.getElementById('canvas');
        if (!flow) {
            canvas.innerHTML = '<svg class="connections-svg" id="connectionsSvg"></svg>';
            return;
        }
        // Clear nodes (keep SVG)
        canvas.querySelectorAll('.node').forEach(n => n.remove());

        // Render nodes
        Object.values(flow.nodes).forEach(node => {
            canvas.appendChild(createNodeElement(node));
        });

        // Render connections
        renderConnections();
    }

    function createNodeElement(node) {
        const div = document.createElement('div');
        div.className = 'node';
        div.dataset.nodeId = node.id;
        div.style.left = node.x + 'px';
        div.style.top = node.y + 'px';

        const statusClass = node.enabled ? 'enabled' : 'disabled';
        const statusText = node.enabled ? 'enabled: 1' : 'enabled: 0';

        div.innerHTML = `
            <div class="connector in" title="Wejście (drop target)"></div>
            <div class="node-header">
                <span class="node-name">${escapeHtml(node.name)}</span>
                <button class="node-edit-btn" onclick="App.openNodeModal('${node.id}')" title="Edytuj">&#9998;</button>
            </div>
            <div class="node-body">
                <div class="node-buildid">${escapeHtml(node.buildid) || '<em style="color:#999">buildid...</em>'}</div>
                <div class="node-status">
                    <span class="${statusClass}">${statusText}</span>
                </div>
            </div>
            <div class="connector out" title="Przeciągnij w dół aby połączyć"></div>
        `;

        // Node dragging from header
        const header = div.querySelector('.node-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('node-edit-btn')) return;
            startDrag(e, node, div);
        });

        // Connector drag (for creating connections) - from bottom connector
        const connOut = div.querySelector('.connector.out');
        connOut.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startConnection(e, node.id);
        });

        return div;
    }

    function renderConnections() {
        const flow = getCurrentFlow();
        const svg = document.getElementById('connectionsSvg');
        if (!svg || !flow) return;

        svg.innerHTML = '';
        // Defs for arrowhead
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" class="connection-arrowhead"/>
            </marker>
        `;
        svg.appendChild(defs);

        flow.connections.forEach((conn, idx) => {
            const fromNode = flow.nodes[conn.from];
            const toNode = flow.nodes[conn.to];
            if (!fromNode || !toNode) return;

            const fromEl = document.querySelector(`[data-node-id="${conn.from}"]`);
            const toEl = document.querySelector(`[data-node-id="${conn.to}"]`);
            if (!fromEl || !toEl) return;

            const fromW = fromEl.offsetWidth;
            const fromH = fromEl.offsetHeight;
            const toW = toEl.offsetWidth;

            // Vertical: from bottom-center of source to top-center of target
            const x1 = fromNode.x + fromW / 2;
            const y1 = fromNode.y + fromH;
            const x2 = toNode.x + toW / 2;
            const y2 = toNode.y;

            // Curved path (vertical)
            const midY = (y1 + y2) / 2;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
            path.setAttribute('class', 'connection-line');
            path.setAttribute('marker-end', 'url(#arrowhead)');
            path.addEventListener('dblclick', () => removeConnection(idx));
            path.addEventListener('mouseenter', function() { this.style.strokeWidth = '4'; });
            path.addEventListener('mouseleave', function() { this.style.strokeWidth = '2'; });
            svg.appendChild(path);

            // Delete button at midpoint
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const delGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            delGroup.setAttribute('class', 'connection-delete');
            delGroup.setAttribute('transform', `translate(${mx - 8}, ${my - 8})`);
            delGroup.innerHTML = `
                <circle cx="8" cy="8" r="8" fill="#c62828" />
                <text x="8" y="12" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">&times;</text>
            `;
            delGroup.style.pointerEvents = 'all';
            delGroup.addEventListener('click', () => removeConnection(idx));
            path.addEventListener('mouseenter', () => { delGroup.style.opacity = '1'; });
            path.addEventListener('mouseleave', () => { delGroup.style.opacity = '0'; });
            delGroup.addEventListener('mouseenter', () => { delGroup.style.opacity = '1'; });
            delGroup.addEventListener('mouseleave', () => { delGroup.style.opacity = '0'; });
            svg.appendChild(delGroup);
        });
    }

    function removeConnection(index) {
        const flow = getCurrentFlow();
        if (!flow) return;
        const conn = flow.connections[index];
        if (conn) {
            const toNode = flow.nodes[conn.to];
            const fromNode = flow.nodes[conn.from];
            if (toNode && fromNode) {
                removeNodeWaitfor(toNode, fromNode.name);
            }
        }
        flow.connections.splice(index, 1);
        renderConnections();
        updateJsonPreview();
    }

    // ========== DRAG & DROP ==========

    function startDrag(e, node, el) {
        e.preventDefault();
        const canvas = document.getElementById('canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const offsetX = e.clientX - canvasRect.left - node.x;
        const offsetY = e.clientY - canvasRect.top - node.y;
        el.classList.add('dragging');

        const onMove = (ev) => {
            node.x = Math.max(0, ev.clientX - canvasRect.left - offsetX);
            node.y = Math.max(0, ev.clientY - canvasRect.top - offsetY);
            el.style.left = node.x + 'px';
            el.style.top = node.y + 'px';
            renderConnections();
        };

        const onUp = () => {
            el.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            expandCanvasIfNeeded();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    function startConnection(e, fromNodeId) {
        e.preventDefault();
        const canvas = document.getElementById('canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const svg = document.getElementById('connectionsSvg');

        const flow = getCurrentFlow();
        const fromNode = flow.nodes[fromNodeId];
        const fromEl = document.querySelector(`[data-node-id="${fromNodeId}"]`);
        // Start from bottom-center
        const x1 = fromNode.x + fromEl.offsetWidth / 2;
        const y1 = fromNode.y + fromEl.offsetHeight;

        const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tempLine.setAttribute('x1', x1);
        tempLine.setAttribute('y1', y1);
        tempLine.setAttribute('x2', x1);
        tempLine.setAttribute('y2', y1);
        tempLine.setAttribute('class', 'connection-temp');
        svg.appendChild(tempLine);

        const onMove = (ev) => {
            tempLine.setAttribute('x2', ev.clientX - canvasRect.left);
            tempLine.setAttribute('y2', ev.clientY - canvasRect.top);
        };

        const onUp = (ev) => {
            tempLine.remove();
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const target = ev.target.closest('.node');
            if (target && target.dataset.nodeId !== fromNodeId) {
                createConnection(fromNodeId, target.dataset.nodeId);
            }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    function createConnection(fromId, toId) {
        const flow = getCurrentFlow();
        if (!flow) return;
        if (fromId === toId) return;

        // Prevent duplicates
        if (flow.connections.some(c => c.from === fromId && c.to === toId)) return;

        // Prevent reverse (cycle)
        if (flow.connections.some(c => c.from === toId && c.to === fromId)) {
            showToast('Cykliczna zależność niedozwolona', 'error');
            return;
        }

        flow.connections.push({ from: fromId, to: toId });

        // Set waitfor on target node
        const fromNode = flow.nodes[fromId];
        const toNode = flow.nodes[toId];
        if (fromNode && toNode) {
            addNodeWaitfor(toNode, fromNode.name);
        }

        renderConnections();
        updateJsonPreview();
    }

    function expandCanvasIfNeeded() {
        const flow = getCurrentFlow();
        if (!flow) return;
        const canvas = document.getElementById('canvas');
        let maxY = 450;
        Object.values(flow.nodes).forEach(n => {
            if (n.y + 120 > maxY) maxY = n.y + 120;
        });
        canvas.style.minHeight = maxY + 'px';
    }

    // ========== NODE MODAL ==========

    function openNodeModal(nodeId) {
        const flow = getCurrentFlow();
        if (!flow || !flow.nodes[nodeId]) return;
        state.editingNodeId = nodeId;
        const node = flow.nodes[nodeId];
        if (isFerrytServer()) {
            normalizeFerrytNode(node);
            editingFerrytType = node.ferrytType || '';
        }

        document.getElementById('nodeEditName').value = isFerrytServer()
            ? normalizeFerrytNodeName(node.name, node.ferrytType)
            : (node.name || '');
        document.getElementById('nodeEditBuildId').value = node.buildid || '';
        document.getElementById('nodeEditEnabled').value = node.enabled;
        document.getElementById('nodeEditWaitfor').value = getNodeWaitforList(node).join(', ');
        document.getElementById('nodeEditRetry').value = node.retry || '';
        document.getElementById('nodeEditExternal').value = node.external || '';
        document.getElementById('nodeEditStop').value = node.stop || '';
        updateNodeModalFieldVisibility(flow.server);

        // Show/hide TC params and load values
        updateTcParamsVisibility(node.buildid || '', node.runnerType || '');
        loadTcParams(node);
        renderFerrytParamsFields(node.ferrytType, node.params || {});

        // Listen for buildid changes to toggle TC params
        const buildIdInput = document.getElementById('nodeEditBuildId');
        buildIdInput.oninput = function() {
            updateTcParamsVisibility(this.value.trim(), node.runnerType || '');
        };

        // Clear previous validation messages
        clearValidation();

        document.getElementById('nodeEditModal').style.display = 'flex';
    }

    function closeNodeModal() {
        const nodeId = state.editingNodeId;
        const flow = getCurrentFlow();
        const shouldDiscardPendingNode =
            nodeId &&
            state.pendingNewNodeId === nodeId &&
            flow &&
            flow.nodes[nodeId] &&
            nodeRequiresCompletedParams(flow.nodes[nodeId]);

        document.getElementById('nodeEditModal').style.display = 'none';
        state.editingNodeId = null;
        editingFerrytType = '';
        if (shouldDiscardPendingNode) {
            state.pendingNewNodeId = null;
            discardPendingNode(nodeId);
            return;
        }
        if (state.pendingNewNodeId === nodeId) {
            state.pendingNewNodeId = null;
        }
    }

    function handleFerrytRenewTypeChange(value) {
        editingFerrytType = value || FERRYT_RENEW_PLACEHOLDER;
        renderFerrytParamsFields(editingFerrytType, {});
        clearValidation();
    }

    function saveNodeEdit() {
        const flow = getCurrentFlow();
        if (!flow || !state.editingNodeId) return;
        const node = flow.nodes[state.editingNodeId];
        const oldName = node.name;
        const rawNewName = document.getElementById('nodeEditName').value.trim();
        const newBuildId = document.getElementById('nodeEditBuildId').value.trim();
        const activeFerrytType = isFerrytServer() ? getFerrytEffectiveType(node.ferrytType) : '';
        const newName = isFerrytServer()
            ? (normalizeFerrytNodeName(rawNewName || node.name, activeFerrytType || node.ferrytType) || node.name)
            : (rawNewName || node.name);

        // Validate name uniqueness
        const nameError = validateNodeName(flow, newName, state.editingNodeId);
        if (nameError) {
            showValidationError('nodeEditName', nameError);
            return;
        }

        // Validate buildid uniqueness
        const buildIdError = validateBuildId(
            flow,
            newBuildId,
            state.editingNodeId,
            isSqlRunnerType(node.runnerType) || isScriptRunnerType(node.runnerType)
        );
        if (buildIdError) {
            showValidationError('nodeEditBuildId', buildIdError);
            return;
        }

        if (isFerrytServer() && isFerrytRenewType(node.ferrytType) && !activeFerrytType) {
            showValidationError('nodeEditFerrytRenewType', 'Wybierz typ Renew');
            return;
        }

        if (isFerrytServer() && activeFerrytType) {
            const ferrytValidation = getFerrytParamsFromModal(activeFerrytType);
            if (ferrytValidation.missingLabel) {
                showValidationError(ferrytValidation.missingFieldId, `Uzupełnij ${ferrytValidation.missingLabel}`);
                return;
            }
        }

        const tcValidation = getTcParamsFromModal({
            ...node,
            buildid: newBuildId
        });
        if (tcValidation.missingLabel) {
            showValidationError(tcValidation.missingFieldId, `Uzupełnij ${tcValidation.missingLabel}`);
            return;
        }

        node.name = newName;
        node.buildid = newBuildId;
        node.enabled = parseInt(document.getElementById('nodeEditEnabled').value);
        if (isFerrytServer(flow.server)) {
            delete node.retry;
            delete node.external;
            delete node.stop;
        } else {
            node.retry = document.getElementById('nodeEditRetry').value.trim();
            node.external = document.getElementById('nodeEditExternal').value.trim();
            node.stop = document.getElementById('nodeEditStop').value.trim();
        }
        if (isFerrytServer()) {
            node.ferrytType = activeFerrytType;
        }

        // Save TC params
        saveTcParams(node, tcValidation.params);
        if (isFerrytServer() && activeFerrytType) {
            const ferrytParams = applyFerrytAutoParams(
                activeFerrytType,
                getFerrytParamsFromModal(activeFerrytType).params
            );
            if (Object.keys(ferrytParams).length > 0) {
                node.params = ferrytParams;
            } else {
                delete node.params;
            }
        } else if (isFerrytServer()) {
            delete node.params;
        }

        // Update waitfor references if name changed
        if (oldName !== newName) {
            Object.values(flow.nodes).forEach(n => {
                replaceNodeWaitfor(n, oldName, newName);
            });
        }

        state.pendingNewNodeId = null;
        logEvent('NODE_SAVE', {
            nodeId: node.id,
            oldName,
            newName,
            buildid: node.buildid || '',
            ferrytType: node.ferrytType || '',
            runnerType: node.runnerType || ''
        });
        closeNodeModal();
        renderCanvas();
        updateJsonPreview();
        renderFerrytToolbarButtons();
    }

    function showValidationError(inputId, message) {
        clearValidation();
        const input = document.getElementById(inputId);
        if (!input) {
            showToast(message, 'error');
            return;
        }
        input.classList.add('validation-error');
        const msg = document.createElement('div');
        msg.className = 'validation-msg';
        msg.textContent = message;
        input.parentElement.appendChild(msg);
        showToast(message, 'error');
    }

    function clearValidation() {
        document.querySelectorAll('.validation-error').forEach(el => el.classList.remove('validation-error'));
        document.querySelectorAll('.validation-msg').forEach(el => el.remove());
    }

    // ========== AUTO LAYOUT (TOP-TO-BOTTOM) ==========

    function autoLayout() {
        const flow = getCurrentFlow();
        if (!flow) return;

        const nodes = Object.values(flow.nodes);
        if (nodes.length === 0) return;

        // Topological sort - level assignment
        const inDegree = {};
        nodes.forEach(n => { inDegree[n.id] = 0; });
        flow.connections.forEach(c => { inDegree[c.to] = (inDegree[c.to] || 0) + 1; });

        const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
        const nodeLevel = {};
        queue.forEach(id => { nodeLevel[id] = 0; });

        let head = 0;
        while (head < queue.length) {
            const currentId = queue[head++];
            flow.connections.filter(c => c.from === currentId).forEach(c => {
                const nextLevel = (nodeLevel[currentId] || 0) + 1;
                nodeLevel[c.to] = Math.max(nodeLevel[c.to] || 0, nextLevel);
                inDegree[c.to]--;
                if (inDegree[c.to] === 0) queue.push(c.to);
            });
        }

        nodes.forEach(n => {
            if (!(n.id in nodeLevel)) nodeLevel[n.id] = 0;
        });

        // Group by level
        const levelGroups = {};
        nodes.forEach(n => {
            const lvl = nodeLevel[n.id];
            if (!levelGroups[lvl]) levelGroups[lvl] = [];
            levelGroups[lvl].push(n);
        });

        // Position: VERTICAL layout (one node per row, top-to-bottom)
        const canvas = document.getElementById('canvas');
        const canvasW = canvas.offsetWidth || 700;
        const nodeW = 180;
        const gapY = 120; // vertical gap between rows
        const startY = 30;
        const centerX = Math.max(30, (canvasW - nodeW) / 2);

        // Flatten levels into a single vertical list
        let row = 0;
        const sortedLevels = Object.keys(levelGroups).map(Number).sort((a, b) => a - b);
        sortedLevels.forEach(level => {
            const group = levelGroups[level];
            group.forEach(node => {
                node.x = centerX;
                node.y = startY + row * gapY;
                row++;
            });
        });

        renderCanvas();
        expandCanvasIfNeeded();
        logEvent('AUTO_LAYOUT', { flowId: flow.id, nodeCount: nodes.length });
    }

    function clearCanvas() {
        const flow = getCurrentFlow();
        if (!flow) return;
        if (!confirm('Wyczyścić wszystkie buildy z tego flow?')) return;
        const clearedNodeCount = Object.keys(flow.nodes).length;
        flow.nodes = {};
        flow.connections = [];
        renderCanvas();
        updateJsonPreview();
        renderFerrytToolbarButtons();
        logEvent('CANVAS_CLEAR', { flowId: flow.id, nodeCount: clearedNodeCount });
    }

    // ========== JSON GENERATION ==========

    function generateJson(flow) {
        if (!flow) return null;
        const json = {
            tcserver: SERVERS[flow.server],
            enabled: flow.enabled
        };

        // runat always present
        json.runat = flow.runat || '';

        const waitforNames = getInterflowWaitforNames(flow);
        if (waitforNames.length === 1) {
            json.waitfor = waitforNames[0];
        } else if (waitforNames.length > 1) {
            json.waitfor = waitforNames;
        }

        // Optional root-level fields
        if (flow.email) json.email = flow.email;
        if (flow.blackout) json.blackout = parseBlackoutValue(flow.blackout);
        if (flow.sms) {
            const smsValues = parseSmsValue(flow.sms);
            if (smsValues.length > 0) {
                json.sms = smsValues;
            }
        }
        if (flow.change) json.change = flow.change;

        // Builds (fixed: "builds" not "bilds")
        json.builds = {};
        const orderedNodes = getOrderedNodes(flow);
        orderedNodes.forEach(node => {
            const build = {};
            const nodeWaitfor = getNodeWaitforList(node);
            if (nodeWaitfor.length === 1) {
                build.waitfor = nodeWaitfor[0];
            } else if (nodeWaitfor.length > 1) {
                build.waitfor = nodeWaitfor;
            }
            build.enabled = node.enabled;
            build.buildid = node.buildid || 'NAZWA_BUILDA';
            if (!isFerrytServer(flow.server) && node.retry) build.retry = node.retry;
            if (!isFerrytServer(flow.server) && node.external) build.external = node.external;
            if (!isFerrytServer(flow.server) && node.stop) build.stop = node.stop;
            // TC params
            const sanitizedParams = isFerrytServer(flow.server)
                ? applyFerrytAutoParams(node.ferrytType, node.params || {})
                : sanitizeParams(node.params || {});
            if (Object.keys(sanitizedParams).length > 0) {
                build.params = sanitizedParams;
            }
            json.builds[node.name] = build;
        });

        return json;
    }

    function getOrderedNodes(flow) {
        const nodes = Object.values(flow.nodes);
        if (nodes.length === 0) return [];

        const inDegree = {};
        nodes.forEach(n => { inDegree[n.id] = 0; });
        flow.connections.forEach(c => {
            inDegree[c.to] = (inDegree[c.to] || 0) + 1;
        });

        const queue = nodes.filter(n => inDegree[n.id] === 0);
        const result = [];
        const visited = new Set();

        while (queue.length > 0) {
            const node = queue.shift();
            if (visited.has(node.id)) continue;
            visited.add(node.id);
            result.push(node);
            flow.connections.filter(c => c.from === node.id).forEach(c => {
                inDegree[c.to]--;
                if (inDegree[c.to] === 0) {
                    const toNode = flow.nodes[c.to];
                    if (toNode) queue.push(toNode);
                }
            });
        }

        // Add disconnected nodes
        nodes.forEach(n => {
            if (!visited.has(n.id)) result.push(n);
        });

        return result;
    }

    function formatJson(obj) {
        // Keep Windows-style line endings so generated files match existing deploy JSON files.
        return JSON.stringify(obj, null, 4).replace(/\n/g, '\r\n');
    }

    function parseBlackoutValue(value) {
        if (!value) return '';

        const parts = value
            .split(',')
            .map(item => item.trim().replace(/^"(.*)"$/, '$1'))
            .filter(Boolean);

        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0];
        return parts;
    }

    function parseSmsValue(value) {
        if (!value) return [];

        return String(value)
            .split(',')
            .map(item => item.trim().replace(/^"(.*)"$/, '$1'))
            .filter(Boolean);
    }

    function updateJsonPreview() {
        const flow = getCurrentFlow();
        const preview = document.getElementById('jsonPreview');
        if (!flow) {
            preview.textContent = '{ }';
            return;
        }
        const json = generateJson(flow);
        preview.innerHTML = syntaxHighlight(formatJson(json));
        renderAllFilesList();
    }

    function syntaxHighlight(json) {
        return json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
            .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
            .replace(/: (\d+)/g, ': <span class="json-number">$1</span>');
    }

    // ========== RENDER FUNCTIONS ==========

    function renderFlowTabs() {
        const wrapper = document.getElementById('flowTabs');
        const serverFlows = getServerFlows();

        if (!serverFlows.find(f => f.id === state.currentFlowId)) {
            state.currentFlowId = serverFlows.length > 0 ? serverFlows[0].id : null;
        }

        wrapper.innerHTML = serverFlows.map(flow => {
            const isActive = flow.id === state.currentFlowId ? 'active' : '';
            return `
                <button class="flow-tab ${isActive}" onclick="App.switchFlow('${flow.id}')">
                    ${escapeHtml(flow.filename || 'untitled')}.json
                    <span class="flow-tab-close" onclick="event.stopPropagation(); App.removeFlow('${flow.id}')">&times;</span>
                </button>
            `;
        }).join('');
    }

    function renderCurrentFlow() {
        loadFlowSettings();
        renderCanvas();
        renderFerrytToolbarButtons();
        renderInterflowDeps();
    }

    function renderInterflowDeps() {
        const list = document.getElementById('interflowList');
        if (!list) return;

        const serverFlows = getServerFlows();
        if (serverFlows.length < 2) {
            list.innerHTML = '<div style="color:#999; font-size:12px; padding:8px;">Dodaj wiecej niz jeden plik JSON, aby ustawic zaleznosci miedzy nimi.</div>';
            return;
        }

        list.innerHTML = serverFlows.map(flow => {
            if (!Array.isArray(flow.interflowWaitfor)) {
                flow.interflowWaitfor = flow.interflowWaitfor ? [flow.interflowWaitfor] : [];
            }

            const otherFlows = serverFlows.filter(candidate => candidate.id !== flow.id);
            const checkboxes = otherFlows.map(candidate => {
                const checked = flow.interflowWaitfor.includes(candidate.id) ? 'checked' : '';
                return `
                    <label class="interflow-checkbox-label">
                        <input type="checkbox" ${checked}
                            onchange="App.toggleInterflowDep('${flow.id}', '${candidate.id}', this.checked)">
                        <span>${escapeHtml(candidate.filename)}.json</span>
                    </label>
                `;
            }).join('');

            return `
                <div class="interflow-item">
                    <label>${escapeHtml(flow.filename)}.json</label>
                    <span>czeka na:</span>
                    <div class="interflow-checkboxes">${checkboxes}</div>
                </div>
            `;
        }).join('');
    }

    function toggleInterflowDep(flowId, waitforFlowId, checked) {
        const flow = state.flows[flowId];
        if (!flow) return;
        if (!Array.isArray(flow.interflowWaitfor)) {
            flow.interflowWaitfor = [];
        }

        if (checked) {
            if (!flow.interflowWaitfor.includes(waitforFlowId)) {
                flow.interflowWaitfor.push(waitforFlowId);
            }
        } else {
            flow.interflowWaitfor = flow.interflowWaitfor.filter(id => id !== waitforFlowId);
        }

        loadFlowSettings();
        updateJsonPreview();
    }

    function renderAllFilesList() {
        const list = document.getElementById('allFilesList');
        const serverFlows = getServerFlows();

        if (serverFlows.length === 0) {
            list.innerHTML = '<div style="color:#999; font-size:12px; padding:8px;">Brak plikow JSON dla tego serwera.</div>';
            return;
        }

        list.innerHTML = serverFlows.map(flow => {
            const buildCount = Object.keys(flow.nodes).length;
            return `
                <div class="file-item">
                    <span class="file-name">${escapeHtml(flow.filename)}.json</span>
                    <span class="file-builds">${buildCount} build${buildCount !== 1 ? 'ów' : ''}</span>
                    <button class="btn btn-secondary btn-sm" onclick="App.saveFlowJsonToDeploy('${flow.id}')">Zapisz</button>
                </div>
            `;
        }).join('');
    }

    function updateFlowCount() {
        const currentServerCount = getServerFlows().length;
        const totalCount = getAllFlowCount();
        syncServerTabs();
        document.getElementById('flowCount').textContent = `Pliki JSON: ${totalCount} | biezacy serwer: ${currentServerCount}`;
    }

    function formatServerCountSummary(serverCounts) {
        if (!serverCounts || typeof serverCounts !== 'object') return '';

        return Object.keys(SERVER_LABELS)
            .map(server => {
                const count = Number(serverCounts[server] || 0);
                return count > 0 ? `${SERVER_LABELS[server]}: ${count}` : '';
            })
            .filter(Boolean)
            .join(', ');
    }

    // ========== SAVE / DOWNLOAD ==========

    async function parseJsonResponse(response) {
        const raw = await response.text();
        if (!raw) {
            return { ok: response.ok };
        }

        try {
            return JSON.parse(raw);
        } catch (error) {
            throw new Error(`Serwer zwrocil niepoprawna odpowiedz (${response.status}).`);
        }
    }

    async function postDeploySaveRequest(payload) {
        const response = await fetch(buildAppUrl('save-deploys.aspx'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            credentials: 'same-origin',
            body: new URLSearchParams({
                payload: JSON.stringify(payload)
            }).toString()
        });

        const data = await parseJsonResponse(response);
        return { ok: response.ok, status: response.status, data };
    }

    async function getDeployFilesRequest(exportDate) {
        const response = await fetch(buildAppUrl(`load-deploys.aspx?exportDate=${encodeURIComponent(exportDate)}`), {
            method: 'GET',
            cache: 'no-store',
            credentials: 'same-origin'
        });

        const data = await parseJsonResponse(response);
        return { ok: response.ok, status: response.status, data };
    }

    function getDeployJsonValue(json, keys, fallback = undefined) {
        const value = getObjectValueCaseInsensitive(json, keys);
        return value === undefined ? fallback : value;
    }

    function getBuildContainer(json) {
        const container = getDeployJsonValue(json, ['builds', 'bilds']);
        if (!container || typeof container !== 'object') return null;
        return container;
    }

    function getBuildNameFromEntry(buildConfig, fallbackName) {
        const explicitName = getObjectValueCaseInsensitive(buildConfig, ['name', 'buildname', 'build_name', 'node', 'nodeName', 'key']);
        const normalizedName = String(explicitName || '').trim();
        return normalizedName || fallbackName;
    }

    function getBuildEntries(json) {
        const container = getBuildContainer(json);
        if (!container) return [];

        if (Array.isArray(container)) {
            return container
                .map((buildConfig, index) => {
                    if (!buildConfig || typeof buildConfig !== 'object') return null;
                    const fallbackName = `Build_${index + 1}`;
                    return [getBuildNameFromEntry(buildConfig, fallbackName), buildConfig];
                })
                .filter(Boolean);
        }

        return Object.entries(container).map(([nodeName, buildConfig], index) => {
            const safeBuildConfig = buildConfig && typeof buildConfig === 'object'
                ? buildConfig
                : {};
            const fallbackName = String(nodeName || '').trim() || `Build_${index + 1}`;
            return [getBuildNameFromEntry(safeBuildConfig, fallbackName), safeBuildConfig];
        });
    }

    function normalizeParamsSource(params) {
        if (!params) return {};

        if (Array.isArray(params)) {
            return params.reduce((result, item) => {
                if (!item || typeof item !== 'object') {
                    return result;
                }

                const key = getObjectValueCaseInsensitive(item, ['key', 'name', 'param', 'id']);
                if (key === undefined || key === null || String(key).trim() === '') {
                    return result;
                }

                result[String(key).trim()] = getObjectValueCaseInsensitive(item, ['value', 'val', 'content']);
                return result;
            }, {});
        }

        if (typeof params === 'object') {
            return params;
        }

        return {};
    }

    function getSkippedFileLabel(item) {
        return String((item && (item.relativePath || item.filename)) || '')
            .trim();
    }

    function getSkippedFilesMessage(skippedFiles) {
        if (!Array.isArray(skippedFiles) || skippedFiles.length === 0) return '';
        const skippedNames = skippedFiles.map(getSkippedFileLabel).filter(Boolean);
        if (skippedNames.length === 0) return '';
        if (skippedNames.length <= 3) {
            return skippedNames.join(', ');
        }
        return `${skippedNames.slice(0, 3).join(', ')} +${skippedNames.length - 3}`;
    }

    function findServerByTcserver(tcserver) {
        const normalized = String(tcserver || '')
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/+$/, '');
        if (!normalized) return '';
        if (normalized.includes('haateamcity.mbank.pl')) return 'haaTeamCity';
        if (normalized.includes('teamcity.mbank.pl')) return 'teamcity';
        return '';
    }

    function hasFerrytSignature(filename, json) {
        if (/^ferryt_/i.test(stripJsonExtension(filename))) {
            return true;
        }

        const builds = getBuildEntries(json).map(([, buildConfig]) => buildConfig);

        return builds.some(build => {
            const buildId = String(getObjectValueCaseInsensitive(build, ['buildid', 'buildId', 'build_id']) || '').trim();
            const params = sanitizeParams(normalizeParamsSource(getObjectValueCaseInsensitive(build, ['params'])));

            return /^DEIZUKC_Ferryt_/i.test(buildId) ||
                buildId === FERRYT_RENEW_BUILD_ID ||
                Object.prototype.hasOwnProperty.call(params, 'deploy_PackageName') ||
                Object.prototype.hasOwnProperty.call(params, 'ImportProcessPackageName') ||
                Object.prototype.hasOwnProperty.call(params, 'RenewAppFileNameTC') ||
                Object.prototype.hasOwnProperty.call(params, 'RenewAppTC') ||
                Object.prototype.hasOwnProperty.call(params, 'RenewAppSQLTC') ||
                Object.prototype.hasOwnProperty.call(params, 'todo');
        });
    }

    function detectServerFromDeployJson(filename, json) {
        const explicitServer = findServerByTcserver(getDeployJsonValue(json, ['tcserver'], ''));
        if (explicitServer === 'haaTeamCity') {
            return explicitServer;
        }
        if (hasFerrytSignature(filename, json)) {
            return 'ferryt';
        }
        return explicitServer || 'teamcity';
    }

    function setLoadDeployBusy(isBusy) {
        const buttons = [];
        document.querySelectorAll('.inline-field-button').forEach(button => buttons.push(button));

        buttons.forEach(button => {
            if (!button) return;
            button.disabled = isBusy;
            button.textContent = isBusy ? 'Wczytywanie...' : 'Wczytaj z daty';
        });
    }

    function importDeployFiles(files, exportDate) {
        const importedFlows = {};
        const importedOrder = [];
        const importedEntries = [];
        const skippedFiles = [];
        const serverCounts = {
            haaTeamCity: 0,
            teamcity: 0,
            ferryt: 0
        };
        let importedNodeCounter = 0;

        files.forEach((file, fileIndex) => {
            const relativePath = String(file && file.relativePath ? file.relativePath : '').trim();
            const fileName = String(file && file.filename ? file.filename : '').trim();
            const rawContent = normalizeJsonFileContent(file && file.content ? file.content : '');
            if (!fileName) return;
            if (!rawContent) {
                skippedFiles.push({ filename: fileName, relativePath, reason: 'empty_content' });
                return;
            }

            const parsedJson = parseDeployJsonContent(rawContent);
            if (!parsedJson) {
                skippedFiles.push({ filename: fileName, relativePath, reason: 'invalid_json' });
                return;
            }

            const server = detectServerFromDeployJson(fileName, parsedJson);
            if (Object.prototype.hasOwnProperty.call(serverCounts, server)) {
                serverCounts[server]++;
            }
            const filename = stripJsonExtension(fileName) || `deploy_${fileIndex + 1}`;
            const inferredFerrytChange = server === 'ferryt' && /^Ferryt_/i.test(filename)
                ? filename.replace(/^Ferryt_/i, '')
                : '';

            const flow = createFlowModel(server, {
                id: generateFlowId(),
                filename,
                savedFilename: filename,
                enabled: normalizeFlag(getDeployJsonValue(parsedJson, ['enabled'], 1), 1),
                runat: String(getDeployJsonValue(parsedJson, ['runat'], '') || ''),
                email: String(getDeployJsonValue(parsedJson, ['email'], '') || ''),
                blackout: formatBlackoutForInput(getDeployJsonValue(parsedJson, ['blackout'], '')),
                sms: formatSmsForInput(getDeployJsonValue(parsedJson, ['sms'], '')),
                change: String(getDeployJsonValue(parsedJson, ['change'], '') || inferredFerrytChange || ''),
                nodes: {},
                connections: [],
                interflowWaitfor: []
            });

            const nodeNameMap = {};

            getBuildEntries(parsedJson).forEach(([nodeName, buildConfig], buildIndex) => {
                importedNodeCounter++;
                const nodeId = 'node_' + importedNodeCounter;
                const safeBuild = buildConfig && typeof buildConfig === 'object' ? buildConfig : {};
                const params = sanitizeParams(normalizeParamsSource(getObjectValueCaseInsensitive(safeBuild, ['params'])));
                const buildId = String(getObjectValueCaseInsensitive(safeBuild, ['buildid', 'buildId', 'build_id']) || '').trim();
                const runnerType = isTcSql(buildId)
                    ? 'sql'
                    : (isTcPowerShell(buildId) ? 'script' : (isTcRunOnly(buildId) ? 'runonly' : ''));

                const node = {
                    id: nodeId,
                    name: String(nodeName || `Build_${buildIndex + 1}`),
                    buildid: buildId,
                    enabled: normalizeFlag(getObjectValueCaseInsensitive(safeBuild, ['enabled']), 1),
                    waitfor: '',
                    retry: server === 'ferryt' ? '' : String(getObjectValueCaseInsensitive(safeBuild, ['retry']) || ''),
                    external: server === 'ferryt' ? '' : String(getObjectValueCaseInsensitive(safeBuild, ['external']) || ''),
                    stop: server === 'ferryt' ? '' : String(getObjectValueCaseInsensitive(safeBuild, ['stop']) || ''),
                    ferrytType: '',
                    runnerType,
                    x: Math.max(30, 120 + (fileIndex % 3) * 28),
                    y: 30 + buildIndex * 110
                };

                if (Object.keys(params).length > 0) {
                    node.params = params;
                }

                if (server === 'ferryt') {
                    normalizeFerrytNode(node);
                }

                setNodeWaitforList(node, getObjectValueCaseInsensitive(safeBuild, ['waitfor']));
                flow.nodes[nodeId] = node;
                nodeNameMap[node.name] = nodeId;
            });

            Object.values(flow.nodes).forEach(node => {
                const dependencies = getNodeWaitforList(node);
                if (dependencies.length === 0) {
                    setNodeWaitforList(node, []);
                    return;
                }

                setNodeWaitforList(node, dependencies);

                dependencies.forEach(dependencyName => {
                    const dependencyId = nodeNameMap[dependencyName];
                    if (!dependencyId || dependencyId === node.id) return;
                    if (!flow.connections.some(connection => connection.from === dependencyId && connection.to === node.id)) {
                        flow.connections.push({ from: dependencyId, to: node.id });
                    }
                });
            });

            importedFlows[flow.id] = flow;
            importedOrder.push(flow.id);
            importedEntries.push({
                flow,
                rootWaitfor: parseDelimitedNames(getDeployJsonValue(parsedJson, ['waitfor'], ''))
            });
        });

        if (importedOrder.length === 0) {
            const skippedMessage = getSkippedFilesMessage(skippedFiles);
            throw new Error(skippedMessage
                ? `Nie udalo sie wczytac zadnego pliku JSON. Pominiete: ${skippedMessage}`
                : 'Brak poprawnych plikow JSON do wczytania dla wybranej daty.');
        }

        importedEntries.forEach(entry => {
            const candidates = Object.values(importedFlows).filter(flow =>
                flow.server === entry.flow.server && flow.id !== entry.flow.id
            );

            entry.flow.interflowWaitfor = entry.rootWaitfor
                .map(waitforName => candidates.find(candidate => stripJsonExtension(candidate.filename) === waitforName))
                .filter(Boolean)
                .map(candidate => candidate.id);
        });

        state.flows = importedFlows;
        state.flowOrder = importedOrder;
        state.nodeCounter = importedNodeCounter;
        state.exportDate = exportDate;
        state.editingNodeId = null;
        state.pendingNewNodeId = null;
        const nodeModal = document.getElementById('nodeEditModal');
        if (nodeModal) nodeModal.style.display = 'none';

        const availableServers = importedOrder
            .map(flowId => importedFlows[flowId] && importedFlows[flowId].server)
            .filter(Boolean);
        const preferredServer = availableServers.includes(state.currentServer)
            ? state.currentServer
            : (availableServers[0] || 'haaTeamCity');

        state.currentServer = preferredServer;
        state.currentFlowId = importedOrder.find(flowId => importedFlows[flowId].server === preferredServer) || importedOrder[0];
        saveState();
        return {
            importedCount: importedOrder.length,
            skippedFiles,
            serverCounts
        };
    }

    async function loadDeploysForDate() {
        const loadToastDurationMs = 45000;
        const exportDate = state.exportDate || getTodayIsoDate();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(exportDate)) {
            showToast('Ustaw poprawna date instalacji', 'error');
            return;
        }

        if (!confirm(`Wczytac pliki JSON z katalogu ${AUTO_SAVE_ROOT}\\${exportDate}? Biezaca zawartosc edytora zostanie zastapiona.`)) {
            return;
        }

        setLoadDeployBusy(true);
        try {
            const result = await getDeployFilesRequest(exportDate);
            const data = result.data || {};
            if (!result.ok || !data.ok) {
                throw new Error(data.error || `Blad odczytu (${result.status})`);
            }

            const importResult = importDeployFiles(Array.isArray(data.files) ? data.files : [], exportDate);
            syncServerTabs();
            updateServerSpecificUI();
            renderFlowTabs();
            renderCurrentFlow();
            updateFlowCount();
            updateJsonPreview();
            renderInterflowDeps();
            renderAllFilesList();
            updateExportDate(exportDate);
            const serverCountSummary = formatServerCountSummary(importResult.serverCounts);
            showToastWithDuration(
                `Wczytano ${importResult.importedCount} plik(ow) JSON z daty ${exportDate}${serverCountSummary ? ` (${serverCountSummary})` : ''}`,
                'success',
                loadToastDurationMs
            );
            if (Array.isArray(importResult.skippedFiles) && importResult.skippedFiles.length > 0) {
                showToastWithDuration(
                    `Pominieto ${importResult.skippedFiles.length} plik(ow): ${getSkippedFilesMessage(importResult.skippedFiles)}`,
                    'info',
                    loadToastDurationMs
                );
            }
            if (Array.isArray(data.readErrors) && data.readErrors.length > 0) {
                showToastWithDuration(
                    `Nie odczytano ${data.readErrors.length} plik(ow): ${getSkippedFilesMessage(data.readErrors)}`,
                    'info',
                    loadToastDurationMs
                );
            }
            logEvent('JSON_LOAD_DEPLOY', {
                exportDate,
                directory: data.directory || `${AUTO_SAVE_ROOT}\\${exportDate}`,
                count: importResult.importedCount,
                skippedFiles: Array.isArray(importResult.skippedFiles)
                    ? importResult.skippedFiles.map(getSkippedFileLabel)
                    : [],
                readErrors: Array.isArray(data.readErrors)
                    ? data.readErrors.map(getSkippedFileLabel)
                    : [],
                files: Array.isArray(data.files) ? data.files.map(file => file.filename) : []
            });
        } catch (error) {
            showToastWithDuration(
                `Wczytanie nieudane: ${error && error.message ? error.message : 'Brak odpowiedzi z endpointu odczytu.'}`,
                'error',
                loadToastDurationMs
            );
        } finally {
            setLoadDeployBusy(false);
        }
    }

    async function saveFilesToDeploy(files, successMessage, logType, logDetails = {}) {
        if (!files || files.length === 0) {
            showToast('Brak plików do zapisania', 'error');
            return false;
        }

        const exportDate = state.exportDate || getTodayIsoDate();
        try {
            const result = await postDeploySaveRequest({
                exportDate,
                server: state.currentServer,
                files
            });
            const data = result.data || {};
            if (!result.ok || !data.ok) {
                throw new Error(data.error || `Blad zapisu (${result.status})`);
            }
            files.forEach(file => {
                if (!file || !file.flowId || !state.flows[file.flowId]) return;
                state.flows[file.flowId].savedFilename = stripJsonExtension(file.filename || '');
            });
            saveState();
            showToast(successMessage || 'Plik zapisany', 'success');
            logEvent(logType, {
                ...logDetails,
                exportDate,
                directory: data.directory || `${AUTO_SAVE_ROOT}\\${exportDate}`,
                count: data.saved || files.length,
                deletedFiles: Array.isArray(data.deletedFiles) ? data.deletedFiles : [],
                files: Array.isArray(data.files) && data.files.length > 0
                    ? data.files
                    : files.map(file => file.filename)
            });
            return true;
        } catch (error) {
            showToast(`Zapis nieudany: ${error && error.message ? error.message : 'Brak połączenia z endpointem zapisu.'}`, 'error');
            return false;
        }
    }

    function getFlowDeployFile(flow) {
        if (!flow) return null;
        applyFerrytFlowDefaults(flow);
        const safeName = getSafeDeployFilenameBase(flow.filename);
        const savedName = stripJsonExtension(flow.savedFilename || '');
        const file = {
            flowId: flow.id,
            filename: `${safeName}.json`,
            content: formatJson(generateJson(flow))
        };

        if (savedName && savedName.toLowerCase() !== safeName.toLowerCase()) {
            file.previousFilename = `${savedName}.json`;
        }

        return file;
    }

    async function saveCurrentJsonToDeploy() {
        const flow = getCurrentFlow();
        if (!flow) return;
        await saveFilesToDeploy(
            [getFlowDeployFile(flow)],
            `Zapisano ${flow.filename}.json do katalogu Deploy`,
            'JSON_SAVE_CURRENT',
            { flowId: flow.id, filename: flow.filename || '' }
        );
    }

    async function saveFlowJsonToDeploy(flowId) {
        const flow = state.flows[flowId];
        if (!flow) return;
        await saveFilesToDeploy(
            [getFlowDeployFile(flow)],
            `Zapisano ${flow.filename}.json do katalogu Deploy`,
            'JSON_SAVE_FLOW',
            { flowId, filename: flow.filename || '' }
        );
    }

    async function saveAllJsonToDeploy() {
        const serverFlows = getServerFlows();
        if (serverFlows.length === 0) {
            showToast('Brak flows do zapisania', 'error');
            return;
        }
        await saveFilesToDeploy(
            collectDeployFiles(serverFlows),
            `Zapisano ${serverFlows.length} plik(ów) do katalogu Deploy`,
            'JSON_SAVE_ALL',
            { server: state.currentServer, flowCount: serverFlows.length }
        );
    }

    function downloadCurrentJson() {
        const flow = getCurrentFlow();
        if (!flow) return;
        logEvent('JSON_DOWNLOAD_CURRENT', { flowId: flow.id, filename: flow.filename || '' });
        downloadJsonFile(flow.filename + '.json', generateJson(flow));
    }

    function downloadFlowJson(flowId) {
        const flow = state.flows[flowId];
        if (!flow) return;
        logEvent('JSON_DOWNLOAD_FLOW', { flowId, filename: flow.filename || '' });
        downloadJsonFile(flow.filename + '.json', generateJson(flow));
    }

    function downloadAllJson() {
        const serverFlows = getServerFlows();
        if (serverFlows.length === 0) {
            showToast('Brak flows do pobrania', 'error');
            return;
        }
        serverFlows.forEach(flow => {
            downloadJsonFile(flow.filename + '.json', generateJson(flow));
        });
        showToast(`Pobrano ${serverFlows.length} plik(ów) JSON`, 'success');
        logEvent('JSON_DOWNLOAD_ALL', { server: state.currentServer, flowCount: serverFlows.length });
    }

    function downloadJsonFile(filename, jsonObj) {
        const baseName = sanitizeWindowsFileName((filename || '').replace(/\.json$/i, '')) || 'deploy';
        const blob = new Blob([formatJson(jsonObj)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function copyJson() {
        const flow = getCurrentFlow();
        if (!flow) return;
        logEvent('JSON_COPY', { flowId: flow.id, filename: flow.filename || '' });
        navigator.clipboard.writeText(formatJson(generateJson(flow))).then(() => {
            showToast('JSON skopiowany do schowka', 'success');
        }).catch(() => {
            showToast('Nie udało się skopiować', 'error');
        });
    }

    // ========== UTILITIES ==========

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function extractBuildIdFromInput(value) {
        const trimmedValue = (value || '').trim();
        if (!trimmedValue) {
            return '';
        }

        const withoutHashOrQuery = trimmedValue.split('#')[0].split('?')[0].trim();
        const pathParts = withoutHashOrQuery
            .split('/')
            .map(part => part.trim())
            .filter(Boolean);

        const markerIndex = pathParts.findIndex(part => /^buildConfigur(?:ation|adion)$/i.test(part));
        if (markerIndex !== -1 && pathParts[markerIndex + 1]) {
            return decodeURIComponent(pathParts[markerIndex + 1]).trim();
        }

        return withoutHashOrQuery;
    }

    function parseBuildListInput(value) {
        return value
            .split('\n')
            .map(line => extractBuildIdFromInput(line))
            .filter(line => line.length > 0);
    }

    function showToast(message, type) {
        return showToastWithDuration(message, type, 3000);
    }

    function showToastWithDuration(message, type, durationMs) {
        const toast = document.createElement('div');
        toast.className = `toast ${type || 'info'}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), Math.max(0, Number(durationMs) || 3000));
    }

    function updateAutoSaveStatus(message, isError = false, title = '') {
        const status = document.getElementById('autoSaveStatus');
        if (!status) return;
        status.textContent = message;
        status.title = title || message;
        status.classList.toggle('error', isError);
    }

    function getAutoSaveStatusLabel(exportDate) {
        return `Zapis do: ${AUTO_SAVE_ROOT}\\${exportDate}`;
    }

    function updateExportDate(value) {
        state.exportDate = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : getTodayIsoDate();
        const input = document.getElementById('deployFolderDate');
        if (input) input.value = state.exportDate;
        const targetDir = `${AUTO_SAVE_ROOT}\\${state.exportDate}`;
        updateAutoSaveStatus(getAutoSaveStatusLabel(state.exportDate), false, targetDir);
    }

    function collectDeployFiles(serverFlows) {
        return serverFlows.map(flow => {
            applyFerrytFlowDefaults(flow);
            const safeName = sanitizeWindowsFileName(flow.filename || 'deploy') || 'deploy';
            return {
                filename: `${safeName}.json`,
                content: formatJson(generateJson(flow))
            };
        });
    }

    // ========== SAVE/LOAD STATE (localStorage) ==========

    function saveState() {
        try {
            localStorage.setItem(getStorageKey(), JSON.stringify({
                currentServer: state.currentServer,
                currentFlowId: state.currentFlowId,
                flows: state.flows,
                flowOrder: state.flowOrder,
                nodeCounter: state.nodeCounter,
                exportDate: state.exportDate || getTodayIsoDate()
            }));
        } catch (e) { /* ignore */ }
    }

    function loadState() {
        state.exportDate = getTodayIsoDate();
        try {
            const data = JSON.parse(localStorage.getItem(getStorageKey()));
            if (data && data.flows && Object.keys(data.flows).length > 0) {
                const validServers = new Set(Object.keys(SERVERS));
                const sanitizedFlows = Object.fromEntries(
                    Object.entries(data.flows).filter(([, flow]) => flow && validServers.has(flow.server))
                );
                const sanitizedFlowOrder = (data.flowOrder || []).filter(id => sanitizedFlows[id]);

                if (Object.keys(sanitizedFlows).length === 0) {
                    return false;
                }

                state.currentServer = validServers.has(data.currentServer) ? data.currentServer : 'haaTeamCity';
                state.flows = sanitizedFlows;
                state.flowOrder = sanitizedFlowOrder;
                state.currentFlowId = sanitizedFlows[data.currentFlowId] ? data.currentFlowId : sanitizedFlowOrder[0] || null;
                state.nodeCounter = data.nodeCounter || 0;

                Object.values(state.flows).forEach(flow => {
                    flow.savedFilename = stripJsonExtension(flow.savedFilename || flow.filename || '');
                    if (Array.isArray(flow.interflowWaitfor)) {
                        flow.interflowWaitfor = flow.interflowWaitfor.filter(id => state.flows[id] && state.flows[id].server === flow.server);
                    } else {
                        const names = parseDelimitedNames(flow.waitfor);
                        flow.interflowWaitfor = names.length > 0
                            ? Object.values(state.flows)
                                .filter(candidate => candidate.server === flow.server && candidate.id !== flow.id)
                                .filter(candidate => names.includes(candidate.filename) || names.includes(candidate.filename + '.json'))
                                .map(candidate => candidate.id)
                            : [];
                    }

                    delete flow.waitfor;
                    applyFerrytFlowDefaults(flow);
                    if (isFerrytServer(flow.server)) {
                        Object.values(flow.nodes || {}).forEach(node => {
                            delete node.retry;
                            delete node.external;
                            delete node.stop;
                            normalizeFerrytNode(node);
                        });
                    }
                });

                return true;
            }
        } catch (e) { /* ignore */ }
        state.exportDate = getTodayIsoDate();
        return false;
    }

    function withSave(fn) {
        return function(...args) {
            const result = fn.apply(this, args);
            saveState();
            return result;
        };
    }

    function setBulkDrawerOpen(isOpen) {
        const drawer = document.getElementById('bulkDrawer');
        const overlay = document.getElementById('bulkDrawerOverlay');
        if (!drawer || !overlay) return;
        drawer.classList.toggle('open', isOpen);
        overlay.classList.toggle('open', isOpen);
        drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    }

    function toggleBulkDrawer() {
        const drawer = document.getElementById('bulkDrawer');
        if (!drawer) return;
        setBulkDrawerOpen(!drawer.classList.contains('open'));
    }

    function closeBulkDrawer() {
        setBulkDrawerOpen(false);
    }

    // ========== BULK PASTE BUILDS ==========

    function bulkAddBuilds() {
        let flow = getCurrentFlow();
        if (!flow) {
            ensureCurrentServerFlow();
            flow = getCurrentFlow();
        }
        if (!flow) return;
        const textarea = document.getElementById('bulkBuildList');
        const externalCheckbox = document.getElementById('bulkBuildExternal');
        const lines = parseBuildListInput(textarea.value);
        const forceExternal = !!(externalCheckbox && externalCheckbox.checked && !isFerrytServer(flow.server));

        if (lines.length === 0) {
            showToast('Wklej przynajmniej jedną nazwę builda', 'error');
            return;
        }

        // Check for duplicates in input
        const seen = new Set();
        const duplicates = [];
        lines.forEach(name => {
            if (seen.has(name)) duplicates.push(name);
            seen.add(name);
        });
        if (duplicates.length > 0) {
            showToast(`Duplikaty na liście: ${duplicates.join(', ')}`, 'error');
            return;
        }

        // Check name conflicts with existing nodes
        const existingNames = new Set(Object.values(flow.nodes).map(n => n.name));
        const conflicts = lines.filter(name => existingNames.has(name));

        let addedNames = lines;
        if (conflicts.length > 0) {
            // Auto-rename conflicting by appending suffix
            addedNames = lines.map(name => {
                let finalName = name;
                let counter = 2;
                while (existingNames.has(finalName)) {
                    finalName = name + '_' + counter;
                    counter++;
                }
                existingNames.add(finalName);
                return finalName;
            });
            showToast(`Zmieniono nazwy ${conflicts.length} konfliktujących buildów`, 'info');
        }

        const canvas = document.getElementById('canvas');
        const canvasW = canvas.offsetWidth || 600;
        const nodeW = 180;
        const existingCount = Object.keys(flow.nodes).length;

        addedNames.forEach((name, i) => {
            state.nodeCounter++;
            const nodeId = 'node_' + state.nodeCounter;
            flow.nodes[nodeId] = {
                id: nodeId,
                name: name,
                buildid: lines[i], // original name as buildid
                enabled: 1,
                waitfor: '',
                retry: !isFerrytServer(flow.server) ? '1' : '',
                external: forceExternal ? '1' : (!isFerrytServer(flow.server) ? '' : ''),
                x: Math.max(30, (canvasW - nodeW) / 2),
                y: 30 + (existingCount + i) * 110
            };
        });

        textarea.value = '';
        renderCanvas();
        updateJsonPreview();
        expandCanvasIfNeeded();
        closeBulkDrawer();
        showToast(`Dodano ${addedNames.length} buildów do flow`, 'success');
        logEvent('BULK_ADD_BUILDS', {
            flowId: flow.id,
            count: addedNames.length,
            builds: addedNames.join(','),
            external: forceExternal ? '1' : '0'
        });
    }

    function updateServerSpecificUI() {
        const isHaaTeamCity = state.currentServer === 'haaTeamCity';
        const ferryt = isFerrytServer();
        const genericAddBtn = document.getElementById('btnAddNodeGeneric');
        const sqlRunnerBtn = document.getElementById('btnAddSqlRunner');
        const scriptRunnerBtn = document.getElementById('btnAddScriptRunner');
        const runOnlyBtn = document.getElementById('btnAddRunOnlyRunner');
        const validateFerrytBtn = document.getElementById('btnValidateFerryt');
        const ferrytToolbar = document.getElementById('ferrytToolbarActions');
        if (genericAddBtn) genericAddBtn.style.display = ferryt ? 'none' : '';
        if (sqlRunnerBtn) sqlRunnerBtn.style.display = isHaaTeamCity ? '' : 'none';
        if (scriptRunnerBtn) scriptRunnerBtn.style.display = isHaaTeamCity ? '' : 'none';
        if (runOnlyBtn) runOnlyBtn.style.display = isHaaTeamCity ? '' : 'none';
        if (validateFerrytBtn) validateFerrytBtn.style.display = ferryt ? '' : 'none';
        if (ferrytToolbar) ferrytToolbar.style.display = ferryt ? 'flex' : 'none';
    }

    function updateNodeModalFieldVisibility(server = state.currentServer) {
        const waitforGroup = document.getElementById('nodeEditWaitforGroup');
        const retryGroup = document.getElementById('nodeEditRetryGroup');
        const externalGroup = document.getElementById('nodeEditExternalGroup');
        const stopGroup = document.getElementById('nodeEditStopGroup');
        const ferryt = isFerrytServer(server);

        if (waitforGroup) waitforGroup.style.display = 'none';
        if (retryGroup) retryGroup.style.display = ferryt ? 'none' : 'flex';
        if (externalGroup) externalGroup.style.display = ferryt ? 'none' : 'flex';
        if (stopGroup) stopGroup.style.display = ferryt ? 'none' : 'flex';
    }

    function getFerrytParamsFromInputs(item, getInput) {
        if (!item) {
            return { params: {}, missingFieldId: null, missingLabel: null };
        }

        const params = {};
        for (const field of item.fields) {
            const input = getInput(field);
            const value = input ? input.value.trim() : '';
            const finalValue = value || field.defaultValue || '';

            if (field.required && !finalValue) {
                return {
                    params: {},
                    missingFieldId: input ? input.id : null,
                    missingLabel: field.label
                };
            }

            if (finalValue) {
                params[field.key] = finalValue;
            }
        }

        return { params, missingFieldId: null, missingLabel: null };
    }

    function renderFerrytToolbarButtons() {
        const container = document.getElementById('ferrytToolbarActions');
        const flow = getCurrentFlow();

        if (!container) return;
        if (!flow || !isFerrytServer()) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = 'flex';
        container.innerHTML = FERRYT_TOOLBAR_ITEMS.map(item =>
            `<button class="btn btn-secondary ferryt-toolbar-btn" onclick="App.addFerrytBuild('${escapeHtml(item.buildType)}')">+ ${escapeHtml(item.label)}</button>`
        ).join('');
    }

    function addFerrytBuild(buildType) {
        const flow = getCurrentFlow();
        if (!flow || !isFerrytServer()) return;

        const item = buildType === FERRYT_RENEW_PLACEHOLDER
            ? { buildType: FERRYT_RENEW_PLACEHOLDER, buildId: FERRYT_RENEW_BUILD_ID }
            : getFerrytCatalogItem(buildType);
        if (!item) return;
        const nodeId = addNodeWithConfig({
            name: getUniqueNodeName(flow, buildType === FERRYT_RENEW_PLACEHOLDER ? 'Renew' : item.buildType),
            buildid: item.buildId,
            ferrytType: item.buildType,
            params: {}
        });

        if (!nodeId) return;

        if (nodeRequiresCompletedParams(flow.nodes[nodeId])) {
            state.pendingNewNodeId = nodeId;
        }
        openNodeModal(nodeId);
        logEvent('FERRYT_BUILD_ADD', { nodeId, buildType: item.buildType, buildId: item.buildId || '' });
    }

    function collectFerrytValidationPayload(flow) {
        const packages = [];
        const skipped = [];

        Object.values(flow.nodes).forEach(node => {
            normalizeFerrytNode(node);
            const item = getFerrytCatalogItem(node.ferrytType);
            if (!item || !item.artifactoryFolder || !item.packageField) {
                skipped.push({
                    nodeName: node.name,
                    buildType: node.ferrytType || '',
                    reason: 'Typ buildu nie wymaga sprawdzania w Artifactory'
                });
                return;
            }

            const packageName = ((node.params || {})[item.packageField] || '').trim();
            if (!packageName) {
                skipped.push({
                    nodeName: node.name,
                    buildType: node.ferrytType || '',
                    reason: `Brak wartości ${item.packageField}`
                });
                return;
            }

            packages.push({
                nodeName: node.name,
                buildType: item.buildType,
                folder: item.artifactoryFolder,
                package: packageName
            });
        });

        return { packages, skipped };
    }

    function setFerrytValidationBusy(isBusy) {
        const button = document.getElementById('btnValidateFerryt');
        if (!button) return;
        button.disabled = isBusy;
        button.textContent = isBusy ? 'Validate...' : 'Validate';
    }

    function closeValidationResult() {
        const modal = document.getElementById('validationResultModal');
        if (modal) modal.style.display = 'none';
    }

    function renderValidationResult(result, localSkipped = []) {
        const modal = document.getElementById('validationResultModal');
        const body = document.getElementById('validationResultBody');
        if (!modal || !body) return;

        const missing = Array.isArray(result.missing) ? result.missing : [];
        const found = Array.isArray(result.found) ? result.found : [];
        const skipped = [...(Array.isArray(result.skipped) ? result.skipped : []), ...localSkipped];
        const error = result.error ? `<div class="validation-summary validation-summary-error">${escapeHtml(result.error)}</div>` : '';

        const renderRows = items => items.map(item => `
            <div class="validation-row">
                <div class="validation-main">
                    <strong>${escapeHtml(item.nodeName || item.buildType || 'Build')}</strong>
                    <span>${escapeHtml(item.package || item.reason || '')}</span>
                </div>
                <div class="validation-meta">
                    ${item.folder ? `<span>${escapeHtml(item.folder)}</span>` : ''}
                    ${item.reason ? `<span>${escapeHtml(item.reason)}</span>` : ''}
                </div>
            </div>
        `).join('');

        body.innerHTML = `
            ${error}
            <div class="validation-summary-grid">
                <div class="validation-summary"><strong>Znalezione:</strong> ${found.length}</div>
                <div class="validation-summary validation-summary-missing"><strong>Brakujące:</strong> ${missing.length}</div>
                <div class="validation-summary"><strong>Pominięte:</strong> ${skipped.length}</div>
            </div>
            <div class="validation-section">
                <h4>Znalezione</h4>
                ${found.length > 0 ? renderRows(found) : '<div class="validation-empty">Brak</div>'}
            </div>
            <div class="validation-section">
                <h4>Brakujące</h4>
                ${missing.length > 0 ? renderRows(missing) : '<div class="validation-empty">Brak</div>'}
            </div>
            <div class="validation-section">
                <h4>Pominięte</h4>
                ${skipped.length > 0 ? renderRows(skipped) : '<div class="validation-empty">Brak</div>'}
            </div>
        `;

        modal.style.display = 'flex';
    }

    async function validateFerrytPackages() {
        const flow = getCurrentFlow();
        if (!flow || !isFerrytServer()) return;

        const validation = collectFerrytValidationPayload(flow);
        if (validation.packages.length === 0) {
            showToast('Brak buildów Ferryt do sprawdzenia w Artifactory', 'error');
            return;
        }

        logEvent('FERRYT_VALIDATE_START', {
            flowId: flow.id,
            filename: flow.filename || '',
            packageCount: validation.packages.length
        });
        setFerrytValidationBusy(true);
        try {
            const response = await fetch(buildAppUrl('validate-artifactory.aspx'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    flowName: flow.filename || '',
                    change: flow.change || '',
                    packages: validation.packages
                })
            });

            const data = await parseValidationResponse(response);
            renderValidationResult(data, validation.skipped);

            if (!response.ok || data.ok === false) {
                logEvent('FERRYT_VALIDATE_ERROR', {
                    flowId: flow.id,
                    filename: flow.filename || '',
                    error: data.error || 'response_not_ok'
                });
                showToast(data.error || 'Walidacja Artifactory zakończona błędem', 'error');
                return;
            }

            if (Array.isArray(data.missing) && data.missing.length > 0) {
                logEvent('FERRYT_VALIDATE_MISSING', {
                    flowId: flow.id,
                    filename: flow.filename || '',
                    missingCount: data.missing.length
                });
                showToast(`Brakuje ${data.missing.length} paczek w Artifactory`, 'error');
                return;
            }

            logEvent('FERRYT_VALIDATE_OK', {
                flowId: flow.id,
                filename: flow.filename || '',
                packageCount: validation.packages.length
            });
            showToast('Wszystkie paczki są dostępne w Artifactory', 'success');
        } catch (error) {
            logEvent('FERRYT_VALIDATE_ERROR', {
                flowId: flow.id,
                filename: flow.filename || '',
                error: error.message || 'request_failed'
            });
            renderValidationResult({ ok: false, error: error.message || 'Nie udało się wykonać walidacji.' }, validation.skipped);
            showToast(error.message || 'Nie udało się połączyć z walidacją Artifactory', 'error');
        } finally {
            setFerrytValidationBusy(false);
        }
    }

    async function parseValidationResponse(response) {
        const raw = await response.text();
        if (!raw) {
            return {
                ok: response.ok
            };
        }

        try {
            return JSON.parse(raw);
        } catch (error) {
            const normalized = raw
                .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            const snippet = normalized ? normalized.slice(0, 220) : raw.slice(0, 220).trim();
            const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
            throw new Error(`Serwer zwrocil niepoprawny JSON (${status}). ${snippet || 'Brak tresci odpowiedzi.'}`);
        }
    }

    // ========== KEYBOARD SHORTCUTS ==========

    function initKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeNodeModal();
            if (e.key === 'Escape') closeBulkDrawer();
            if (e.key === 'Escape') closeValidationResult();
            if (e.key === 'Delete' && state.editingNodeId) deleteNode();
        });
    }

    // ========== INIT ==========

    async function fetchUsername() {
        try {
            const resp = await fetch(buildAppUrl('whoami.aspx'));
            if (resp.ok) {
                const data = await resp.json();
                currentUsername = data.username || '';
            }
        } catch (e) {
            currentUsername = '';
        }
    }

    async function init() {
        await fetchUsername();
        const loaded = loadState();
        if (!loaded) {
            addFlow();
        } else {
            switchServer(state.currentServer);
        }
        const exportDateInput = document.getElementById('deployFolderDate');
        if (exportDateInput) {
            exportDateInput.value = state.exportDate;
        }
        populateRunatSelect();
        updateServerSpecificUI();
        renderFlowTabs();
        renderCurrentFlow();
        updateFlowCount();
        updateJsonPreview();
        renderInterflowDeps();
        renderAllFilesList();
        updateAutoSaveStatus(getAutoSaveStatusLabel(state.exportDate), false, `${AUTO_SAVE_ROOT}\\${state.exportDate}`);
        initKeyboard();
        setInterval(saveState, 5000);
        logEvent('PAGE_LOAD', { loadedFromStorage: loaded, user: currentUsername || '' });
    }

    // ========== PUBLIC API ==========
    return {
        init,
        addFlow: withSave(addFlow),
        removeFlow: withSave(removeFlow),
        closeAllFlows: withSave(closeAllFlows),
        switchFlow,
        switchServer,
        updateFlowSetting: withSave(updateFlowSetting),
        updateExportDate: withSave(updateExportDate),
        addNode: withSave(addNode),
        deleteNode: withSave(deleteNode),
        openNodeModal,
        closeNodeModal,
        saveNodeEdit: withSave(saveNodeEdit),
        autoLayout: withSave(autoLayout),
        clearCanvas: withSave(clearCanvas),
        copyJson,
        saveCurrentJsonToDeploy,
        saveFlowJsonToDeploy,
        saveAllJsonToDeploy,
        loadDeploysForDate,
        downloadCurrentJson,
        downloadFlowJson,
        downloadAllJson,
        handleFerrytRenewTypeChange,
        bulkAddBuilds: withSave(bulkAddBuilds),
        toggleInterflowDep: withSave(toggleInterflowDep),
        toggleBulkDrawer,
        closeBulkDrawer,
        addFerrytBuild: withSave(addFerrytBuild),
        validateFerrytPackages,
        closeValidationResult,
        addSqlRunner: withSave(addSqlRunner),
        addScriptRunner: withSave(addScriptRunner),
        addRunOnlyRunner: withSave(addRunOnlyRunner)
    };
})();

window.App = App;
document.addEventListener('DOMContentLoaded', App.init);
