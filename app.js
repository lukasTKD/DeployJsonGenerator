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
        editingNodeId: null,
        dragging: null,
        connecting: null
    };

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

    function addFlow() {
        const id = 'flow_' + Date.now();
        state.flows[id] = {
            id,
            filename: 'deploy_' + (state.flowOrder.length + 1),
            server: state.currentServer,
            enabled: 1,
            runat: '',
            email: '',
            blackout: '',
            sms: '',
            change: '',
            nodes: {},
            connections: [],
            interflowWaitfor: [] // ARRAY - multiple dependencies
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
            if (Array.isArray(f.interflowWaitfor)) {
                f.interflowWaitfor = f.interflowWaitfor.filter(wid => wid !== flowId);
            }
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
        renderFlowTabs();
        renderCurrentFlow();
        updateJsonPreview();
        renderAllFilesList();
        renderInterflowDeps();
    }

    function getCurrentFlow() {
        return state.flows[state.currentFlowId] || null;
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
        if (key === 'filename') {
            renderFlowTabs();
            renderInterflowDeps();
        }
        updateJsonPreview();
        renderAllFilesList();
    }

    function loadFlowSettings() {
        const flow = getCurrentFlow();
        if (!flow) return;
        populateRunatSelect();
        document.getElementById('flowFilename').value = flow.filename || '';
        document.getElementById('flowRunat').value = flow.runat || '';
        // waitfor is derived from interflowWaitfor - show as comma-separated filenames
        const waitforNames = getInterflowWaitforNames(flow);
        document.getElementById('flowWaitfor').value = waitforNames.join(', ') || '';
        document.getElementById('flowEmail').value = flow.email || '';
        document.getElementById('flowBlackout').value = flow.blackout || '';
        document.getElementById('flowSms').value = flow.sms || '';
        document.getElementById('flowChange').value = flow.change || '';
        document.getElementById('flowEnabled').value = flow.enabled;
    }

    function getInterflowWaitforNames(flow) {
        if (!Array.isArray(flow.interflowWaitfor)) return [];
        return flow.interflowWaitfor
            .map(fid => state.flows[fid])
            .filter(f => f)
            .map(f => f.filename);
    }

    // ========== VALIDATORS ==========

    function validateNodeName(flow, name, excludeNodeId) {
        const duplicate = Object.values(flow.nodes).find(
            n => n.name === name && n.id !== excludeNodeId
        );
        return duplicate ? `Nazwa "${name}" już istnieje w tym flow` : null;
    }

    function validateBuildId(flow, buildid, excludeNodeId) {
        if (!buildid) return null; // empty is allowed (placeholder used)
        const duplicate = Object.values(flow.nodes).find(
            n => n.buildid === buildid && n.id !== excludeNodeId
        );
        return duplicate ? `buildid "${buildid}" jest już używane przez "${duplicate.name}"` : null;
    }

    // ========== NODE MANAGEMENT ==========

    function addNode() {
        const flow = getCurrentFlow();
        if (!flow) return;
        state.nodeCounter++;
        const nodeId = 'node_' + state.nodeCounter;
        // Vertical layout: stack nodes top-to-bottom
        const existingCount = Object.keys(flow.nodes).length;
        const canvas = document.getElementById('canvas');
        const canvasW = canvas.offsetWidth || 600;
        const nodeW = 180;
        flow.nodes[nodeId] = {
            id: nodeId,
            name: 'Build_' + state.nodeCounter,
            buildid: '',
            enabled: 1,
            waitfor: '',
            retry: '',
            external: '',
            x: Math.max(30, (canvasW - nodeW) / 2), // centered
            y: 30 + existingCount * 110
        };
        renderCanvas();
        updateJsonPreview();
        expandCanvasIfNeeded();
    }

    function deleteNode() {
        const flow = getCurrentFlow();
        if (!flow || !state.editingNodeId) return;
        const nodeId = state.editingNodeId;
        const deletedName = flow.nodes[nodeId].name;
        // Remove connections involving this node
        flow.connections = flow.connections.filter(
            c => c.from !== nodeId && c.to !== nodeId
        );
        // Update waitfor references
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
                    ${node.waitfor ? ' | waitfor: ' + escapeHtml(node.waitfor) : ''}
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

        document.getElementById('nodeEditName').value = node.name || '';
        document.getElementById('nodeEditBuildId').value = node.buildid || '';
        document.getElementById('nodeEditEnabled').value = node.enabled;
        document.getElementById('nodeEditWaitfor').value = node.waitfor || '';
        document.getElementById('nodeEditRetry').value = node.retry || '';
        document.getElementById('nodeEditExternal').value = node.external || '';

        // Clear previous validation messages
        clearValidation();

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
        const newBuildId = document.getElementById('nodeEditBuildId').value.trim();

        // Validate name uniqueness
        const nameError = validateNodeName(flow, newName, state.editingNodeId);
        if (nameError) {
            showValidationError('nodeEditName', nameError);
            return;
        }

        // Validate buildid uniqueness
        const buildIdError = validateBuildId(flow, newBuildId, state.editingNodeId);
        if (buildIdError) {
            showValidationError('nodeEditBuildId', buildIdError);
            return;
        }

        node.name = newName;
        node.buildid = newBuildId;
        node.enabled = parseInt(document.getElementById('nodeEditEnabled').value);
        node.retry = document.getElementById('nodeEditRetry').value.trim();
        node.external = document.getElementById('nodeEditExternal').value.trim();

        // Update waitfor references if name changed
        if (oldName !== newName) {
            Object.values(flow.nodes).forEach(n => {
                if (n.waitfor === oldName) n.waitfor = newName;
            });
        }

        closeNodeModal();
        renderCanvas();
        updateJsonPreview();
    }

    function showValidationError(inputId, message) {
        clearValidation();
        const input = document.getElementById(inputId);
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

        // Position: TOP-TO-BOTTOM layout
        const canvas = document.getElementById('canvas');
        const canvasW = canvas.offsetWidth || 700;
        const gapY = 120; // vertical gap between levels
        const gapX = 200; // horizontal gap between siblings
        const startY = 30;

        Object.entries(levelGroups).forEach(([level, group]) => {
            const totalWidth = group.length * gapX;
            const startX = Math.max(20, (canvasW - totalWidth) / 2);
            group.forEach((node, idx) => {
                node.x = startX + idx * gapX;
                node.y = startY + parseInt(level) * gapY;
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

        // waitfor from interflow dependencies (can be multiple)
        const waitforNames = getInterflowWaitforNames(flow);
        if (waitforNames.length === 1) {
            json.waitfor = waitforNames[0];
        } else if (waitforNames.length > 1) {
            json.waitfor = waitforNames.join(',');
        }

        // Optional root-level fields
        if (flow.email) json.email = flow.email;
        if (flow.blackout) json.blackout = flow.blackout;
        if (flow.sms) json.sms = flow.sms;
        if (flow.change) json.change = flow.change;

        // Builds (fixed: "builds" not "bilds")
        json.builds = {};
        const orderedNodes = getOrderedNodes(flow);
        orderedNodes.forEach(node => {
            const build = {};
            if (node.waitfor) build.waitfor = node.waitfor;
            build.enabled = node.enabled;
            build.buildid = node.buildid || 'NAZWA_BUILDA';
            if (node.retry) build.retry = node.retry;
            if (node.external) build.external = node.external;
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
        wrapper.innerHTML = serverFlows.map(flow => {
            const isActive = flow.id === state.currentFlowId ? 'active' : '';
            return `
                <button class="flow-tab ${isActive}" onclick="App.switchFlow('${flow.id}')">
                    ${escapeHtml(flow.filename || 'untitled')}.json
                    <span class="flow-tab-close" onclick="event.stopPropagation(); App.removeFlow('${flow.id}')">&times;</span>
                </button>
            `;
        }).join('');

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
            // Migrate old string format to array
            if (!Array.isArray(flow.interflowWaitfor)) {
                flow.interflowWaitfor = flow.interflowWaitfor ? [flow.interflowWaitfor] : [];
            }
            const otherFlows = serverFlows.filter(f => f.id !== flow.id);
            const checkboxes = otherFlows.map(f => {
                const checked = flow.interflowWaitfor.includes(f.id) ? 'checked' : '';
                return `
                    <label class="interflow-checkbox-label">
                        <input type="checkbox" ${checked}
                            onchange="App.toggleInterflowDep('${flow.id}', '${f.id}', this.checked)">
                        <span>${escapeHtml(f.filename)}.json</span>
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
        if (!Array.isArray(flow.interflowWaitfor)) flow.interflowWaitfor = [];

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
        document.getElementById('flowCount').textContent = `Flows: ${getServerFlows().length}`;
    }

    // ========== DOWNLOAD ==========

    function downloadCurrentJson() {
        const flow = getCurrentFlow();
        if (!flow) return;
        downloadJsonFile(flow.filename + '.json', generateJson(flow));
    }

    function downloadFlowJson(flowId) {
        const flow = state.flows[flowId];
        if (!flow) return;
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
            localStorage.setItem('deployJsonGenerator', JSON.stringify({
                currentServer: state.currentServer,
                currentFlowId: state.currentFlowId,
                flows: state.flows,
                flowOrder: state.flowOrder,
                nodeCounter: state.nodeCounter
            }));
        } catch (e) { /* ignore */ }
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
                // Migrate old interflowWaitfor string to array
                Object.values(state.flows).forEach(f => {
                    if (!Array.isArray(f.interflowWaitfor)) {
                        f.interflowWaitfor = f.interflowWaitfor ? [f.interflowWaitfor] : [];
                    }
                });
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function withSave(fn) {
        return function(...args) {
            const result = fn.apply(this, args);
            saveState();
            return result;
        };
    }

    // ========== EXTERNA MODE ==========

    let externaJson = null;

    function switchMode(mode) {
        document.querySelectorAll('.mode-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.mode === mode);
        });
        document.getElementById('editorMode').style.display = mode === 'editor' ? '' : 'none';
        document.getElementById('externaMode').style.display = mode === 'externa' ? '' : 'none';

        if (mode === 'externa') {
            populateExternaRunat();
            updateExternaBuildCount();
        }
    }

    function populateExternaRunat() {
        const select = document.getElementById('externaRunat');
        if (select.options.length > 1) return;
        generateTimeOptions().forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            select.appendChild(opt);
        });
    }

    function updateExternaBuildCount() {
        const textarea = document.getElementById('externaBuildList');
        const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        document.getElementById('externaBuildCount').textContent = `${lines.length} buildów`;
    }

    function generateExterna() {
        const textarea = document.getElementById('externaBuildList');
        const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        if (lines.length === 0) {
            showToast('Wklej przynajmniej jedną nazwę builda', 'error');
            return;
        }

        // Check for duplicates
        const seen = new Set();
        const duplicates = [];
        lines.forEach(name => {
            if (seen.has(name)) duplicates.push(name);
            seen.add(name);
        });
        if (duplicates.length > 0) {
            showToast(`Duplikaty: ${duplicates.join(', ')}`, 'error');
            return;
        }

        const serverKey = document.getElementById('externaServer').value;
        const runat = document.getElementById('externaRunat').value;
        const waitfor = document.getElementById('externaWaitfor').value.trim();

        const json = {
            tcserver: SERVERS[serverKey],
            enabled: 1,
            runat: runat || '',
            waitfor: waitfor || ''
        };

        json.builds = {};
        lines.forEach(name => {
            json.builds[name] = {
                enabled: 1,
                buildid: name,
                externa: 1
            };
        });

        externaJson = json;

        const preview = document.getElementById('externaJsonPreview');
        preview.innerHTML = syntaxHighlight(formatJson(json));
        showToast(`Wygenerowano JSON z ${lines.length} buildami`, 'success');
    }

    function copyExternaJson() {
        if (!externaJson) {
            showToast('Najpierw wygeneruj JSON', 'error');
            return;
        }
        navigator.clipboard.writeText(formatJson(externaJson)).then(() => {
            showToast('JSON skopiowany do schowka', 'success');
        }).catch(() => {
            showToast('Nie udało się skopiować', 'error');
        });
    }

    function downloadExternaJson() {
        if (!externaJson) {
            showToast('Najpierw wygeneruj JSON', 'error');
            return;
        }
        const filename = (document.getElementById('externaFilename').value.trim() || 'externa_deploy') + '.json';
        downloadJsonFile(filename, externaJson);
    }

    // ========== KEYBOARD SHORTCUTS ==========

    function initKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeNodeModal();
            if (e.key === 'Delete' && state.editingNodeId) deleteNode();
        });
    }

    // ========== INIT ==========

    function init() {
        const loaded = loadState();
        if (!loaded) {
            addFlow();
        } else {
            switchServer(state.currentServer);
        }
        populateRunatSelect();
        renderFlowTabs();
        renderCurrentFlow();
        updateFlowCount();
        updateJsonPreview();
        renderInterflowDeps();
        renderAllFilesList();
        initKeyboard();
        setInterval(saveState, 5000);
        // Live build count for externa
        const extTextarea = document.getElementById('externaBuildList');
        if (extTextarea) {
            extTextarea.addEventListener('input', updateExternaBuildCount);
        }
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
        toggleInterflowDep: withSave(toggleInterflowDep),
        copyJson,
        downloadCurrentJson,
        downloadFlowJson,
        downloadAllJson,
        switchMode,
        generateExterna,
        copyExternaJson,
        downloadExternaJson
    };
})();

document.addEventListener('DOMContentLoaded', App.init);
