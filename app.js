/**
 * Deploy JSON Generator - Visual Flow Editor
 * Main application logic: nodes, connections, flows, JSON generation
 */

const App = (() => {
    // ========== STATE ==========
    const SERVERS = {
        haaTeamCity: 'https://haateamcity.mbank.pl',
        teamcity: 'https://teamcity.mbank.pl'
    };

    let state = {
        currentServer: 'haaTeamCity',
        currentFlowId: null,
        flows: {},
        flowOrder: [],
        nodeCounter: 0,
        // Drag state
        dragging: null,
        connecting: null,
        tempLine: null
    };

    // ========== FLOW MANAGEMENT ==========

    function addFlow() {
        const id = 'flow_' + Date.now();
        state.flows[id] = {
            id,
            filename: 'deploy_' + (state.flowOrder.length + 1),
            server: state.currentServer,
            enabled: 1,
            runat: '',
            waitfor: '',
            email: '',
            blackout: '',
            sms: '',
            change: '',
            nodes: {},
            connections: [],
            interflowWaitfor: ''
        };
        state.flowOrder.push(id);
        state.currentFlowId = id;
        renderFlowTabs();
        renderCurrentFlow();
        updateFlowCount();
        updateJsonPreview();
        renderInterflowDeps();
        renderAllFilesList();
        return id;
    }

    function removeFlow(flowId) {
        if (state.flowOrder.length <= 1) {
            showToast('Nie można usunąć ostatniego flow', 'error');
            return;
        }
        if (!confirm('Usunąć ten flow?')) return;
        delete state.flows[flowId];
        state.flowOrder = state.flowOrder.filter(id => id !== flowId);
        // Clean up interflow references
        Object.values(state.flows).forEach(f => {
            if (f.interflowWaitfor === flowId) f.interflowWaitfor = '';
        });
        if (state.currentFlowId === flowId) {
            state.currentFlowId = state.flowOrder[0];
        }
        renderFlowTabs();
        renderCurrentFlow();
        updateFlowCount();
        updateJsonPreview();
        renderInterflowDeps();
        renderAllFilesList();
    }

    function switchFlow(flowId) {
        state.currentFlowId = flowId;
        renderFlowTabs();
        renderCurrentFlow();
        updateJsonPreview();
    }

    function switchServer(server) {
        state.currentServer = server;
        document.querySelectorAll('.server-tabs-container .tab').forEach(t => {
            t.classList.toggle('active', t.dataset.server === server);
        });
        // Filter flows for current server or show all
        renderFlowTabs();
        renderCurrentFlow();
        updateJsonPreview();
        renderAllFilesList();
    }

    function getCurrentFlow() {
        return state.flows[state.currentFlowId] || null;
    }

    function getServerFlows() {
        return state.flowOrder
            .map(id => state.flows[id])
            .filter(f => f.server === state.currentServer);
    }

    // ========== FLOW SETTINGS ==========

    function updateFlowSetting(key, value) {
        const flow = getCurrentFlow();
        if (!flow) return;
        flow[key] = value;
        if (key === 'filename') renderFlowTabs();
        updateJsonPreview();
        renderAllFilesList();
        if (key === 'filename') renderInterflowDeps();
    }

    function loadFlowSettings() {
        const flow = getCurrentFlow();
        if (!flow) return;
        document.getElementById('flowFilename').value = flow.filename || '';
        document.getElementById('flowRunat').value = flow.runat || '';
        document.getElementById('flowWaitfor').value = flow.waitfor || '';
        document.getElementById('flowEmail').value = flow.email || '';
        document.getElementById('flowBlackout').value = flow.blackout || '';
        document.getElementById('flowSms').value = flow.sms || '';
        document.getElementById('flowChange').value = flow.change || '';
        document.getElementById('flowEnabled').value = flow.enabled;
    }

    // ========== NODE MANAGEMENT ==========

    function addNode() {
        const flow = getCurrentFlow();
        if (!flow) return;
        state.nodeCounter++;
        const nodeId = 'node_' + state.nodeCounter;
        const canvas = document.getElementById('canvas');
        const rect = canvas.getBoundingClientRect();
        // Place node at a random-ish position
        const existingCount = Object.keys(flow.nodes).length;
        const col = existingCount % 3;
        const row = Math.floor(existingCount / 3);
        flow.nodes[nodeId] = {
            id: nodeId,
            name: 'Build_' + state.nodeCounter,
            buildid: '',
            enabled: 1,
            waitfor: '',
            retry: '',
            external: '',
            x: 30 + col * 200,
            y: 30 + row * 120
        };
        renderCanvas();
        updateJsonPreview();
    }

    function deleteNode() {
        const flow = getCurrentFlow();
        if (!flow || !state.editingNodeId) return;
        const nodeId = state.editingNodeId;
        // Remove connections involving this node
        flow.connections = flow.connections.filter(
            c => c.from !== nodeId && c.to !== nodeId
        );
        // Update waitfor references
        const deletedName = flow.nodes[nodeId].name;
        Object.values(flow.nodes).forEach(n => {
            if (n.waitfor === deletedName) n.waitfor = '';
        });
        delete flow.nodes[nodeId];
        closeNodeModal();
        renderCanvas();
        updateJsonPreview();
    }

    // ========== CANVAS RENDERING ==========

    function renderCanvas() {
        const flow = getCurrentFlow();
        const canvas = document.getElementById('canvas');
        const svg = document.getElementById('connectionsSvg');
        if (!flow) {
            canvas.innerHTML = '<svg class="connections-svg" id="connectionsSvg"></svg>';
            return;
        }
        // Clear nodes (keep SVG)
        const existingNodes = canvas.querySelectorAll('.node');
        existingNodes.forEach(n => n.remove());

        // Render nodes
        Object.values(flow.nodes).forEach(node => {
            const el = createNodeElement(node);
            canvas.appendChild(el);
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
            <div class="node-header">
                <span class="node-name">${escapeHtml(node.name)}</span>
                <button class="node-edit-btn" onclick="App.openNodeModal('${node.id}')" title="Edytuj">&#9998;</button>
            </div>
            <div class="node-body">
                <div class="node-buildid">${escapeHtml(node.buildid) || '<em style="color:#999">buildid...</em>'}</div>
                <div class="node-status">
                    <span class="${statusClass}">${statusText}</span>
                    ${node.waitfor ? ' | waitfor: ' + escapeHtml(node.waitfor) : ''}
                </div>
            </div>
            <div class="connector out" title="Przeciągnij aby połączyć"></div>
            <div class="connector in"></div>
        `;

        // Node dragging
        const header = div.querySelector('.node-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('node-edit-btn')) return;
            startDrag(e, node, div);
        });

        // Connector drag (for creating connections)
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

            const fromRect = { w: fromEl.offsetWidth, h: fromEl.offsetHeight };
            const toRect = { w: toEl.offsetWidth, h: toEl.offsetHeight };

            const x1 = fromNode.x + fromRect.w;
            const y1 = fromNode.y + fromRect.h / 2;
            const x2 = toNode.x;
            const y2 = toNode.y + toRect.h / 2;

            // Curved path
            const midX = (x1 + x2) / 2;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
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

            // Show on hover over the path area
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
            if (toNode && fromNode && toNode.waitfor === fromNode.name) {
                toNode.waitfor = '';
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
        state.dragging = { node, el, offsetX, offsetY, canvasRect };

        const onMove = (ev) => {
            const x = Math.max(0, ev.clientX - canvasRect.left - offsetX);
            const y = Math.max(0, ev.clientY - canvasRect.top - offsetY);
            node.x = x;
            node.y = y;
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            renderConnections();
        };

        const onUp = () => {
            el.classList.remove('dragging');
            state.dragging = null;
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
        const x1 = fromNode.x + fromEl.offsetWidth;
        const y1 = fromNode.y + fromEl.offsetHeight / 2;

        // Create temp line
        const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tempLine.setAttribute('x1', x1);
        tempLine.setAttribute('y1', y1);
        tempLine.setAttribute('x2', x1);
        tempLine.setAttribute('y2', y1);
        tempLine.setAttribute('class', 'connection-temp');
        svg.appendChild(tempLine);
        state.connecting = { fromNodeId, tempLine };

        const onMove = (ev) => {
            const mx = ev.clientX - canvasRect.left;
            const my = ev.clientY - canvasRect.top;
            tempLine.setAttribute('x2', mx);
            tempLine.setAttribute('y2', my);
        };

        const onUp = (ev) => {
            tempLine.remove();
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);

            // Find target node
            const target = ev.target.closest('.node');
            if (target && target.dataset.nodeId !== fromNodeId) {
                const toNodeId = target.dataset.nodeId;
                createConnection(fromNodeId, toNodeId);
            }
            state.connecting = null;
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    function createConnection(fromId, toId) {
        const flow = getCurrentFlow();
        if (!flow) return;

        // Prevent duplicates
        const exists = flow.connections.some(c => c.from === fromId && c.to === toId);
        if (exists) return;

        // Prevent self-connection
        if (fromId === toId) return;

        // Prevent reverse duplicate (A->B and B->A creates cycle)
        const reverse = flow.connections.some(c => c.from === toId && c.to === fromId);
        if (reverse) {
            showToast('Cykliczna zależność niedozwolona', 'error');
            return;
        }

        flow.connections.push({ from: fromId, to: toId });

        // Set waitfor on target node
        const fromNode = flow.nodes[fromId];
        const toNode = flow.nodes[toId];
        if (fromNode && toNode) {
            toNode.waitfor = fromNode.name;
        }

        renderConnections();
        updateJsonPreview();
    }

    function expandCanvasIfNeeded() {
        const flow = getCurrentFlow();
        if (!flow) return;
        const canvas = document.getElementById('canvas');
        let maxY = 450;
        let maxX = canvas.offsetWidth;
        Object.values(flow.nodes).forEach(n => {
            if (n.y + 100 > maxY) maxY = n.y + 100;
        });
        canvas.style.minHeight = maxY + 'px';
    }

    // ========== NODE MODAL ==========

    function openNodeModal(nodeId) {
        const flow = getCurrentFlow();
        if (!flow || !flow.nodes[nodeId]) return;
        state.editingNodeId = nodeId;
        const node = flow.nodes[nodeId];

        document.getElementById('nodeEditName').value = node.name || '';
        document.getElementById('nodeEditBuildId').value = node.buildid || '';
        document.getElementById('nodeEditEnabled').value = node.enabled;
        document.getElementById('nodeEditWaitfor').value = node.waitfor || '';
        document.getElementById('nodeEditRetry').value = node.retry || '';
        document.getElementById('nodeEditExternal').value = node.external || '';
        document.getElementById('nodeEditModal').style.display = 'flex';
    }

    function closeNodeModal() {
        document.getElementById('nodeEditModal').style.display = 'none';
        state.editingNodeId = null;
    }

    function saveNodeEdit() {
        const flow = getCurrentFlow();
        if (!flow || !state.editingNodeId) return;
        const node = flow.nodes[state.editingNodeId];
        const oldName = node.name;
        const newName = document.getElementById('nodeEditName').value.trim() || node.name;

        node.name = newName;
        node.buildid = document.getElementById('nodeEditBuildId').value.trim();
        node.enabled = parseInt(document.getElementById('nodeEditEnabled').value);
        node.retry = document.getElementById('nodeEditRetry').value.trim();
        node.external = document.getElementById('nodeEditExternal').value.trim();

        // Update waitfor references if name changed
        if (oldName !== newName) {
            Object.values(flow.nodes).forEach(n => {
                if (n.waitfor === oldName) n.waitfor = newName;
            });
            // Update connections-based waitfor
            flow.connections.forEach(c => {
                const toNode = flow.nodes[c.to];
                const fromNode = flow.nodes[c.from];
                if (toNode && fromNode) {
                    toNode.waitfor = fromNode.name;
                }
            });
        }

        closeNodeModal();
        renderCanvas();
        updateJsonPreview();
    }

    // ========== AUTO LAYOUT ==========

    function autoLayout() {
        const flow = getCurrentFlow();
        if (!flow) return;

        const nodes = Object.values(flow.nodes);
        if (nodes.length === 0) return;

        // Topological sort based on connections
        const levels = {};
        const visited = new Set();
        const inDegree = {};
        nodes.forEach(n => { inDegree[n.id] = 0; });
        flow.connections.forEach(c => { inDegree[c.to] = (inDegree[c.to] || 0) + 1; });

        // BFS-based level assignment
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

        // Assign positions to unvisited nodes too
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

        // Position
        const startX = 40;
        const startY = 30;
        const gapX = 220;
        const gapY = 100;

        Object.entries(levelGroups).forEach(([level, group]) => {
            group.forEach((node, idx) => {
                node.x = startX + parseInt(level) * gapX;
                node.y = startY + idx * gapY;
            });
        });

        renderCanvas();
        expandCanvasIfNeeded();
    }

    function clearCanvas() {
        const flow = getCurrentFlow();
        if (!flow) return;
        if (!confirm('Wyczyścić wszystkie buildy z tego flow?')) return;
        flow.nodes = {};
        flow.connections = [];
        renderCanvas();
        updateJsonPreview();
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

        // Optional root-level fields - only include if set
        if (flow.waitfor) json.waitfor = flow.waitfor;
        if (flow.email) json.email = flow.email;
        if (flow.blackout) json.blackout = flow.blackout;
        if (flow.sms) json.sms = flow.sms;
        if (flow.change) json.change = flow.change;

        // Builds
        json.bilds = {};
        // Order nodes: no-waitfor first, then by connection chain
        const orderedNodes = getOrderedNodes(flow);
        orderedNodes.forEach(node => {
            const build = {};
            if (node.waitfor) build.waitfor = node.waitfor;
            build.enabled = node.enabled;
            build.buildid = node.buildid || 'NAZWA_BUILDA';
            if (node.retry) build.retry = node.retry;
            if (node.external) build.external = node.external;
            json.bilds[node.name] = build;
        });

        return json;
    }

    function getOrderedNodes(flow) {
        const nodes = Object.values(flow.nodes);
        if (nodes.length === 0) return [];

        // Topological sort
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

        // Add any remaining (disconnected) nodes
        nodes.forEach(n => {
            if (!visited.has(n.id)) result.push(n);
        });

        return result;
    }

    function formatJson(obj) {
        return JSON.stringify(obj, null, 4);
    }

    function updateJsonPreview() {
        const flow = getCurrentFlow();
        const preview = document.getElementById('jsonPreview');
        if (!flow) {
            preview.textContent = '{ }';
            return;
        }
        const json = generateJson(flow);
        const formatted = formatJson(json);
        preview.innerHTML = syntaxHighlight(formatted);
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
        wrapper.innerHTML = serverFlows.map(flow => {
            const isActive = flow.id === state.currentFlowId ? 'active' : '';
            return `
                <button class="flow-tab ${isActive}" onclick="App.switchFlow('${flow.id}')">
                    ${escapeHtml(flow.filename || 'untitled')}.json
                    <span class="flow-tab-close" onclick="event.stopPropagation(); App.removeFlow('${flow.id}')">&times;</span>
                </button>
            `;
        }).join('');

        // If current flow not in current server, switch
        if (!serverFlows.find(f => f.id === state.currentFlowId)) {
            if (serverFlows.length > 0) {
                state.currentFlowId = serverFlows[0].id;
            }
        }
    }

    function renderCurrentFlow() {
        loadFlowSettings();
        renderCanvas();
    }

    function renderInterflowDeps() {
        const list = document.getElementById('interflowList');
        const serverFlows = getServerFlows();

        if (serverFlows.length < 2) {
            list.innerHTML = '<div style="color:#999; font-size:12px; padding:8px;">Dodaj więcej niż jeden flow aby ustawić zależności między nimi.</div>';
            return;
        }

        list.innerHTML = serverFlows.map(flow => {
            const otherFlows = serverFlows.filter(f => f.id !== flow.id);
            const options = otherFlows.map(f =>
                `<option value="${f.id}" ${flow.interflowWaitfor === f.id ? 'selected' : ''}>${escapeHtml(f.filename)}.json</option>`
            ).join('');

            return `
                <div class="interflow-item">
                    <label>${escapeHtml(flow.filename)}.json</label>
                    <span>czeka na:</span>
                    <select onchange="App.setInterflowDep('${flow.id}', this.value)">
                        <option value="">-- brak --</option>
                        ${options}
                    </select>
                </div>
            `;
        }).join('');
    }

    function setInterflowDep(flowId, waitforFlowId) {
        const flow = state.flows[flowId];
        if (!flow) return;
        flow.interflowWaitfor = waitforFlowId;
        // Set the waitfor field to the filename of the target flow
        if (waitforFlowId && state.flows[waitforFlowId]) {
            flow.waitfor = state.flows[waitforFlowId].filename;
        } else {
            flow.waitfor = '';
        }
        loadFlowSettings();
        updateJsonPreview();
    }

    function renderAllFilesList() {
        const list = document.getElementById('allFilesList');
        const serverFlows = getServerFlows();

        if (serverFlows.length === 0) {
            list.innerHTML = '<div style="color:#999; font-size:12px; padding:8px;">Brak flows dla tego serwera.</div>';
            return;
        }

        list.innerHTML = serverFlows.map(flow => {
            const buildCount = Object.keys(flow.nodes).length;
            return `
                <div class="file-item">
                    <span class="file-name">${escapeHtml(flow.filename)}.json</span>
                    <span class="file-builds">${buildCount} build${buildCount !== 1 ? 'ów' : ''}</span>
                    <button class="btn btn-secondary btn-sm" onclick="App.downloadFlowJson('${flow.id}')">Pobierz</button>
                </div>
            `;
        }).join('');
    }

    function updateFlowCount() {
        const count = getServerFlows().length;
        document.getElementById('flowCount').textContent = `Flows: ${count}`;
    }

    // ========== DOWNLOAD ==========

    function downloadCurrentJson() {
        const flow = getCurrentFlow();
        if (!flow) return;
        const json = generateJson(flow);
        downloadJsonFile(flow.filename + '.json', json);
    }

    function downloadFlowJson(flowId) {
        const flow = state.flows[flowId];
        if (!flow) return;
        const json = generateJson(flow);
        downloadJsonFile(flow.filename + '.json', json);
    }

    function downloadAllJson() {
        const serverFlows = getServerFlows();
        if (serverFlows.length === 0) {
            showToast('Brak flows do pobrania', 'error');
            return;
        }
        serverFlows.forEach(flow => {
            const json = generateJson(flow);
            downloadJsonFile(flow.filename + '.json', json);
        });
        showToast(`Pobrano ${serverFlows.length} plik(ów) JSON`, 'success');
    }

    function downloadJsonFile(filename, jsonObj) {
        const blob = new Blob([formatJson(jsonObj)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function copyJson() {
        const flow = getCurrentFlow();
        if (!flow) return;
        const json = generateJson(flow);
        navigator.clipboard.writeText(formatJson(json)).then(() => {
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

    function showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type || 'info'}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ========== SAVE/LOAD STATE (localStorage) ==========

    function saveState() {
        try {
            const data = {
                currentServer: state.currentServer,
                currentFlowId: state.currentFlowId,
                flows: state.flows,
                flowOrder: state.flowOrder,
                nodeCounter: state.nodeCounter
            };
            localStorage.setItem('deployJsonGenerator', JSON.stringify(data));
        } catch (e) {
            // Ignore storage errors
        }
    }

    function loadState() {
        try {
            const data = JSON.parse(localStorage.getItem('deployJsonGenerator'));
            if (data && data.flows && Object.keys(data.flows).length > 0) {
                state.currentServer = data.currentServer || 'haaTeamCity';
                state.currentFlowId = data.currentFlowId;
                state.flows = data.flows;
                state.flowOrder = data.flowOrder || [];
                state.nodeCounter = data.nodeCounter || 0;
                return true;
            }
        } catch (e) {
            // Ignore
        }
        return false;
    }

    // Auto-save on changes
    function withSave(fn) {
        return function(...args) {
            const result = fn.apply(this, args);
            saveState();
            return result;
        };
    }

    // ========== KEYBOARD SHORTCUTS ==========

    function initKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Escape closes modal
            if (e.key === 'Escape') {
                closeNodeModal();
            }
            // Delete selected node
            if (e.key === 'Delete' && state.editingNodeId) {
                deleteNode();
            }
        });
    }

    // ========== INIT ==========

    function init() {
        const loaded = loadState();
        if (!loaded) {
            // Create initial flow
            addFlow();
        } else {
            // Render loaded state
            switchServer(state.currentServer);
        }
        renderFlowTabs();
        renderCurrentFlow();
        updateFlowCount();
        updateJsonPreview();
        renderInterflowDeps();
        renderAllFilesList();
        initKeyboard();

        // Auto-save periodically
        setInterval(saveState, 5000);
    }

    // ========== PUBLIC API ==========
    return {
        init,
        addFlow: withSave(addFlow),
        removeFlow: withSave(removeFlow),
        switchFlow,
        switchServer,
        updateFlowSetting: withSave(updateFlowSetting),
        addNode: withSave(addNode),
        deleteNode: withSave(deleteNode),
        openNodeModal,
        closeNodeModal,
        saveNodeEdit: withSave(saveNodeEdit),
        autoLayout: withSave(autoLayout),
        clearCanvas: withSave(clearCanvas),
        setInterflowDep: withSave(setInterflowDep),
        copyJson,
        downloadCurrentJson,
        downloadFlowJson,
        downloadAllJson
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', App.init);
