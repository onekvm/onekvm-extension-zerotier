(() => {
  const runtime = window.OneKVMPluginUI.v1
  const { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, shallowRef } = runtime.vue
  const { NAlert, NButton, NInput, NInputNumber, NSpin, NSwitch, NTabPane, NTabs, NTag, useDialog, useMessage } = runtime.naive
  const idPattern = /^[0-9a-f]{16}$/
  const moonIDPattern = /^[0-9a-f]{10}$/
  const labels = runtime.i18n.createMessages({
    'zh-TW': Object.assign({ title: 'ZeroTier 網路', advanced: '進階選項', description: '加入多個 ZeroTier 網路，查看各網路分配的 IP，或單獨離開並刪除條目。', nodeId: '目前節點 ID', addTitle: '加入網路', networkId: '網路 ID', placeholder: '16 位十六進位網路 ID', add: '加入', leave: '離開並刪除', leaveTitle: '離開此網路？', leaveConfirm: '確定要離開並刪除「{network}」嗎？', cancel: '取消', empty: '尚未加入任何網路。', invalid: '請輸入 16 位十六進位網路 ID。', duplicate: '此網路已在清單中。', assigned: '已分配 IP', pending: '等待網路授權或 IP 分配', offline: 'ZeroTier 服務尚未就緒', options: '網路選項', port: 'UDP 連接埠', managed: '允許受管位址與路由', global: '允許公用位址範圍', defaultRoute: '允許預設路由', dns: '允許 DNS 設定', save: '儲存選項', joined: '已加入網路。', left: '已離開網路並刪除條目。', saved: '網路選項已儲存。', refresh: '重新整理' }, { moonTitle: 'Moon 節點', moonDescription: '加入自建 Moon；Moon ID 同時用作 Seed ID。', moonId: 'Moon ID', moonPlaceholder: '10 位十六進位 Moon ID', moonAdd: '加入 Moon', moonEmpty: '尚未加入任何 Moon。', moonInvalid: '請輸入 10 位十六進位 Moon ID。', moonDuplicate: '此 Moon 已在清單中。', moonRemove: '移除 Moon', moonRemoveTitle: '移除此 Moon？', moonRemoveConfirm: '確定要停止環繞並移除 Moon「{moon}」嗎？', moonAdded: 'Moon 已加入。', moonRemoved: 'Moon 已移除。', moonSeed: 'Seed ID', moonEndpoints: '穩定端點', moonWaiting: '等待 Moon 資料', moonReady: '已連線' }),
    zh: Object.assign({ title: 'ZeroTier 网络', advanced: '高级选项', description: '加入多个 ZeroTier 网络，查看各网络分配的 IP，或单独离开并删除条目。', nodeId: '当前节点 ID', addTitle: '加入网络', networkId: '网络 ID', placeholder: '16 位十六进制网络 ID', add: '加入', leave: '离开并删除', leaveTitle: '离开此网络？', leaveConfirm: '确定要离开并删除“{network}”吗？', cancel: '取消', empty: '尚未加入任何网络。', invalid: '请输入 16 位十六进制网络 ID。', duplicate: '此网络已在列表中。', assigned: '已分配 IP', pending: '等待网络授权或 IP 分配', offline: 'ZeroTier 服务尚未就绪', options: '网络选项', port: 'UDP 端口', managed: '允许托管地址与路由', global: '允许公共地址范围', defaultRoute: '允许默认路由', dns: '允许 DNS 配置', save: '保存选项', joined: '已加入网络。', left: '已离开网络并删除条目。', saved: '网络选项已保存。', refresh: '刷新' }, { moonTitle: 'Moon 节点', moonDescription: '添加自建 Moon；Moon ID 同时用作 Seed ID。', moonId: 'Moon ID', moonPlaceholder: '10 位十六进制 Moon ID', moonAdd: '添加 Moon', moonEmpty: '尚未添加任何 Moon。', moonInvalid: '请输入 10 位十六进制 Moon ID。', moonDuplicate: '此 Moon 已在列表中。', moonRemove: '移除 Moon', moonRemoveTitle: '移除此 Moon？', moonRemoveConfirm: '确定要停止环绕并移除 Moon“{moon}”吗？', moonAdded: 'Moon 已添加。', moonRemoved: 'Moon 已移除。', moonSeed: 'Seed ID', moonEndpoints: '稳定端点', moonWaiting: '等待 Moon 数据', moonReady: '已连接' }),
    en: Object.assign({ title: 'ZeroTier networks', advanced: 'Advanced options', description: 'Join multiple ZeroTier networks, view the IPs assigned by each network, or leave and remove one network at a time.', nodeId: 'Current node ID', addTitle: 'Join a network', networkId: 'Network ID', placeholder: '16-digit hexadecimal network ID', add: 'Join', leave: 'Leave and remove', leaveTitle: 'Leave this network?', leaveConfirm: 'Leave and remove “{network}”?', cancel: 'Cancel', empty: 'No ZeroTier networks have been added.', invalid: 'Enter a 16-digit hexadecimal network ID.', duplicate: 'This network is already in the list.', assigned: 'Assigned IPs', pending: 'Waiting for network authorization or an assigned IP', offline: 'The ZeroTier service is not ready', options: 'Network options', port: 'UDP port', managed: 'Allow managed addresses and routes', global: 'Allow public address ranges', defaultRoute: 'Allow default route', dns: 'Allow DNS configuration', save: 'Save options', joined: 'Network joined.', left: 'Network left and entry removed.', saved: 'Network options saved.', refresh: 'Refresh' }, { moonTitle: 'Moon nodes', moonDescription: 'Add a self-hosted Moon; its Moon ID is also used as the seed ID.', moonId: 'Moon ID', moonPlaceholder: '10-digit hexadecimal Moon ID', moonAdd: 'Add Moon', moonEmpty: 'No Moon nodes have been added.', moonInvalid: 'Enter a 10-digit hexadecimal Moon ID.', moonDuplicate: 'This Moon is already in the list.', moonRemove: 'Remove Moon', moonRemoveTitle: 'Remove this Moon?', moonRemoveConfirm: 'Stop orbiting and remove Moon “{moon}”?', moonAdded: 'Moon added.', moonRemoved: 'Moon removed.', moonSeed: 'Seed ID', moonEndpoints: 'Stable endpoints', moonWaiting: 'Waiting for Moon data', moonReady: 'Connected' }),
  })

  function normalizeID(value) {
    return String(value || '').trim().toLowerCase()
  }

  function parseNetworks(settings) {
    try {
      const parsed = JSON.parse(typeof settings.networks_json === 'string' ? settings.networks_json : '[]')
      if (Array.isArray(parsed)) return [...new Set(parsed.map(normalizeID).filter((id) => idPattern.test(id)))].slice(0, 32)
    } catch (_) {}
    const legacy = normalizeID(settings.network_id)
    return idPattern.test(legacy) ? [legacy] : []
  }

  function normalizeMoonID(value) {
    const id = normalizeID(value)
    return id.length === 16 && id.startsWith('000000') ? id.slice(6) : id
  }

  function parseMoons(settings) {
    try {
      const parsed = JSON.parse(typeof settings.moons_json === 'string' ? settings.moons_json : '[]')
      if (Array.isArray(parsed)) return [...new Set(parsed.map(normalizeMoonID).filter((id) => moonIDPattern.test(id)))].slice(0, 32)
    } catch (_) {}
    return []
  }

  function serialize(networks) {
    return JSON.stringify(networks.map(normalizeID))
  }

  const Page = defineComponent({
    name: 'ZeroTierPage',
    props: { host: { type: Object, required: true } },
    setup(props) {
      const initial = props.host.extension.value.settings
      const networks = ref(parseNetworks(initial))
      const savedNetworks = ref(serialize(networks.value))
      const moons = ref(parseMoons(initial))
      const savedMoons = ref(serialize(moons.value))
      const port = ref(Number(initial.port ?? 9993))
      const allowManaged = ref(initial.allow_managed !== false)
      const allowGlobal = ref(initial.allow_global === true)
      const allowDefault = ref(initial.allow_default === true)
      const allowDNS = ref(initial.allow_dns === true)
      const savedOptions = ref(JSON.stringify([port.value, allowManaged.value, allowGlobal.value, allowDefault.value, allowDNS.value]))
      const newID = ref('')
      const newMoonID = ref('')
      const advancedTab = shallowRef('moons')
      const status = ref({ online: false, nodeId: '', networks: [], moons: [] })
      const busy = ref('')
      const loading = ref(false)
      const error = ref('')
      const dialog = useDialog()
      const message = useMessage()
      let timer = null

      const dirty = computed(() => serialize(networks.value) !== savedNetworks.value || serialize(moons.value) !== savedMoons.value ||
        JSON.stringify([port.value, allowManaged.value, allowGlobal.value, allowDefault.value, allowDNS.value]) !== savedOptions.value)
      const valid = computed(() => networks.value.length <= 32 && networks.value.every((id) => idPattern.test(id)) &&
        moons.value.length <= 32 && moons.value.every((id) => moonIDPattern.test(id)) &&
        Number.isInteger(port.value) && port.value >= 0 && port.value <= 65535)
      const normalizedNewID = computed(() => normalizeID(newID.value))
      const newIDError = computed(() => {
        if (!newID.value) return ''
        if (!idPattern.test(normalizedNewID.value)) return labels.invalid
        if (networks.value.includes(normalizedNewID.value)) return labels.duplicate
        return ''
      })
      const normalizedNewMoonID = computed(() => normalizeMoonID(newMoonID.value))
      const newMoonIDError = computed(() => {
        if (!newMoonID.value) return ''
        if (!moonIDPattern.test(normalizedNewMoonID.value)) return labels.moonInvalid
        if (moons.value.includes(normalizedNewMoonID.value)) return labels.moonDuplicate
        return ''
      })
      const statusByID = computed(() => {
        const map = new Map()
        for (const item of Array.isArray(status.value.networks) ? status.value.networks : []) {
          const id = normalizeID(item?.nwid || item?.id)
          if (idPattern.test(id)) map.set(id, item)
        }
        return map
      })
      const moonStatusByID = computed(() => {
        const map = new Map()
        for (const item of Array.isArray(status.value.moons) ? status.value.moons : []) {
          const id = normalizeMoonID(item?.id)
          if (moonIDPattern.test(id)) map.set(id, item)
        }
        return map
      })

      const unregister = props.host.registerSettings({
        dirty,
        valid,
        showHostActions: false,
        collect: () => ({
          networks_json: serialize(networks.value),
          moons_json: serialize(moons.value),
          port: port.value,
          allow_managed: allowManaged.value,
          allow_global: allowGlobal.value,
          allow_default: allowDefault.value,
          allow_dns: allowDNS.value,
        }),
        reset: (settings) => {
          networks.value = parseNetworks(settings)
          savedNetworks.value = serialize(networks.value)
          moons.value = parseMoons(settings)
          savedMoons.value = serialize(moons.value)
          port.value = Number(settings.port ?? 9993)
          allowManaged.value = settings.allow_managed !== false
          allowGlobal.value = settings.allow_global === true
          allowDefault.value = settings.allow_default === true
          allowDNS.value = settings.allow_dns === true
          savedOptions.value = JSON.stringify([port.value, allowManaged.value, allowGlobal.value, allowDefault.value, allowDNS.value])
        },
      })

      async function refresh(showSpinner = false) {
        if (loading.value) return
        loading.value = true
        if (showSpinner) busy.value = 'refresh'
        try {
          status.value = await props.host.invoke('status')
          error.value = ''
        } catch (reason) {
          error.value = reason instanceof Error ? reason.message : String(reason)
        } finally {
          loading.value = false
          if (busy.value === 'refresh') busy.value = ''
        }
      }

      async function saveNetworkMutation(next, successLabel) {
        const previous = [...networks.value]
        networks.value = next
        const ok = await props.host.saveSettings()
        if (!ok) {
          networks.value = previous
          return false
        }
        savedNetworks.value = serialize(networks.value)
        message.success(successLabel)
        await refresh()
        return true
      }

      async function join() {
        const id = normalizedNewID.value
        if (!idPattern.test(id) || networks.value.includes(id) || busy.value) return
        busy.value = 'join'
        try {
          if (await saveNetworkMutation([...networks.value, id], labels.joined)) newID.value = ''
        } finally {
          busy.value = ''
        }
      }

      async function leave(id) {
        if (busy.value) return false
        busy.value = id
        try {
          return await saveNetworkMutation(networks.value.filter((candidate) => candidate !== id), labels.left)
        } finally {
          busy.value = ''
        }
      }

      function confirmLeave(id, name) {
        const confirmation = dialog.warning({
          title: labels.leaveTitle,
          content: labels.leaveConfirm.replace('{network}', name || id),
          positiveText: labels.leave,
          negativeText: labels.cancel,
          onPositiveClick: async () => {
            if (confirmation.loading || busy.value) return false
            confirmation.loading = true
            confirmation.negativeButtonProps = { disabled: true }
            confirmation.closable = false
            confirmation.maskClosable = false
            confirmation.closeOnEsc = false
            try {
              return await leave(id)
            } catch (reason) {
              message.error(reason instanceof Error ? reason.message : String(reason))
              return false
            } finally {
              confirmation.loading = false
              confirmation.negativeButtonProps = undefined
              confirmation.closable = true
              confirmation.maskClosable = true
              confirmation.closeOnEsc = true
            }
          },
        })
      }

      async function saveMoonMutation(next, successLabel) {
        const previous = [...moons.value]
        moons.value = next
        const ok = await props.host.saveSettings()
        if (!ok) {
          moons.value = previous
          return false
        }
        savedMoons.value = serialize(moons.value)
        message.success(successLabel)
        await refresh()
        return true
      }

      async function addMoon() {
        const id = normalizedNewMoonID.value
        if (!moonIDPattern.test(id) || moons.value.includes(id) || busy.value) return
        busy.value = 'moon-add'
        try {
          if (await saveMoonMutation([...moons.value, id], labels.moonAdded)) newMoonID.value = ''
        } finally {
          busy.value = ''
        }
      }

      async function removeMoon(id) {
        if (busy.value) return false
        busy.value = `moon-${id}`
        try {
          return await saveMoonMutation(moons.value.filter((candidate) => candidate !== id), labels.moonRemoved)
        } finally {
          busy.value = ''
        }
      }

      function confirmRemoveMoon(id) {
        dialog.warning({
          title: labels.moonRemoveTitle,
          content: labels.moonRemoveConfirm.replace('{moon}', id),
          positiveText: labels.moonRemove,
          negativeText: labels.cancel,
          onPositiveClick: () => removeMoon(id),
        })
      }

      async function saveOptions() {
        if (!valid.value || busy.value) return
        busy.value = 'save'
        try {
          if (await props.host.saveSettings()) {
            savedNetworks.value = serialize(networks.value)
            savedMoons.value = serialize(moons.value)
            savedOptions.value = JSON.stringify([port.value, allowManaged.value, allowGlobal.value, allowDefault.value, allowDNS.value])
            message.success(labels.saved)
            await refresh()
          }
        } finally {
          busy.value = ''
        }
      }

      onMounted(() => {
        void refresh(true)
        timer = window.setInterval(() => { void refresh(false) }, 5000)
      })
      onBeforeUnmount(() => {
        unregister()
        if (timer !== null) window.clearInterval(timer)
      })

      function networkCard(id) {
        const item = statusByID.value.get(id)
        const ips = Array.isArray(item?.assignedAddresses) ? item.assignedAddresses : []
        const state = String(item?.status || (status.value.online ? 'REQUESTING_CONFIGURATION' : 'OFFLINE'))
        return h('article', { class: 'zt-network', key: id }, [
          h('div', { class: 'zt-network-copy' }, [
            h('div', { class: 'zt-network-title' }, [
              h('strong', item?.name || id),
              h(NTag, { size: 'small', type: state === 'OK' ? 'success' : 'warning', bordered: false }, { default: () => state }),
            ]),
            item?.name ? h('code', id) : null,
            h('small', labels.assigned),
            ips.length ? h('div', { class: 'zt-addresses' }, ips.map((ip) => h('code', { key: ip }, ip))) :
              h('span', { class: 'zt-pending' }, status.value.online ? labels.pending : labels.offline),
          ]),
          h(NButton, { type: 'error', secondary: true, loading: busy.value === id, disabled: Boolean(busy.value && busy.value !== id), onClick: () => confirmLeave(id, item?.name) }, { default: () => labels.leave }),
        ])
      }

      function moonCard(id) {
        const item = moonStatusByID.value.get(id)
        const roots = Array.isArray(item?.roots) ? item.roots : []
        const endpoints = [...new Set(roots.flatMap((root) => Array.isArray(root?.stableEndpoints) ? root.stableEndpoints : []))]
        const ready = Boolean(item && item.waiting !== true && roots.length)
        return h('article', { class: 'zt-network', key: id }, [
          h('div', { class: 'zt-network-copy' }, [
            h('div', { class: 'zt-network-title' }, [
              h('strong', id),
              h(NTag, { size: 'small', type: ready ? 'success' : 'warning', bordered: false }, { default: () => ready ? labels.moonReady : labels.moonWaiting }),
            ]),
            h('small', labels.moonSeed),
            h('code', id),
            endpoints.length ? h('small', labels.moonEndpoints) : null,
            endpoints.length ? h('div', { class: 'zt-addresses' }, endpoints.map((endpoint) => h('code', { key: endpoint }, endpoint))) : null,
          ]),
          h(NButton, { type: 'error', secondary: true, loading: busy.value === `moon-${id}`, disabled: Boolean(busy.value && busy.value !== `moon-${id}`), onClick: () => confirmRemoveMoon(id) }, { default: () => labels.moonRemove }),
        ])
      }

      function advancedTabProps(name) {
        return {
          id: `zt-tab-${name}`,
          role: 'tab',
          tabindex: advancedTab.value === name ? 0 : -1,
          'aria-selected': advancedTab.value === name,
          'aria-controls': `zt-panel-${name}`,
          onKeydown: (event) => {
            const tabs = [...event.currentTarget.closest('.zt-advanced-tabs').querySelectorAll('[role="tab"]')]
            const index = tabs.indexOf(event.currentTarget)
            const next = { ArrowLeft: tabs[(index + tabs.length - 1) % tabs.length], ArrowRight: tabs[(index + 1) % tabs.length], Home: tabs[0], End: tabs[tabs.length - 1], Enter: tabs[index], ' ': tabs[index] }[event.key]
            if (!next) return
            event.preventDefault()
            next.click()
            next.focus()
          },
        }
      }

      return () => h('section', { class: 'zt-page' }, [
        h('div', { class: 'zt-heading' }, [
          h('div', [h('h2', labels.title), h('p', labels.description)]),
          h('div', { class: 'zt-heading-actions' }, [
            h('div', { class: 'zt-node-id' }, [h('small', labels.nodeId), h('code', status.value.nodeId || '—')]),
            h(NButton, { secondary: true, loading: busy.value === 'refresh', disabled: Boolean(busy.value && busy.value !== 'refresh'), onClick: () => refresh(true) }, { default: () => labels.refresh }),
          ]),
        ]),
        error.value ? h(NAlert, { type: 'error', showIcon: false }, { default: () => error.value }) : null,
        h('article', { class: 'zt-join' }, [
          h('div', [h('strong', labels.addTitle), h('small', labels.networkId)]),
          h('div', { class: 'zt-join-control' }, [
            h(NInput, { value: newID.value, size: 'medium', maxlength: 16, placeholder: labels.placeholder, status: newIDError.value ? 'error' : undefined, disabled: Boolean(busy.value), 'onUpdate:value': (value) => { newID.value = value }, onKeyup: (event) => { if (event.key === 'Enter') join() } }),
            h(NButton, { type: 'primary', size: 'medium', loading: busy.value === 'join', disabled: !idPattern.test(normalizedNewID.value) || networks.value.includes(normalizedNewID.value) || Boolean(busy.value && busy.value !== 'join'), onClick: join }, { default: () => labels.add }),
            h('small', { class: newIDError.value ? 'zt-error' : '', 'aria-hidden': newIDError.value ? undefined : 'true' }, newIDError.value || '\u00a0'),
          ]),
        ]),
        h(NSpin, { show: busy.value === 'refresh' && networks.value.length === 0 }, { default: () => h('div', { class: 'zt-list' }, networks.value.length ? networks.value.map(networkCard) : [h('div', { class: 'zt-empty' }, labels.empty)]) }),
        h('details', { class: 'zt-advanced' }, [
          h('summary', labels.advanced),
          h(NTabs, { class: 'zt-advanced-tabs', type: 'line', role: 'tablist', 'aria-label': labels.advanced, value: advancedTab.value, 'onUpdate:value': (value) => { advancedTab.value = value } }, { default: () => [
            h(NTabPane, { name: 'moons', tab: labels.moonTitle, tabProps: advancedTabProps('moons'), id: 'zt-panel-moons', role: 'tabpanel', 'aria-labelledby': 'zt-tab-moons', displayDirective: 'show' }, { default: () => h('section', { class: 'zt-moons' }, [
              h('p', { class: 'zt-moon-description' }, labels.moonDescription),
              h('article', { class: 'zt-join' }, [
                h('div', [h('strong', labels.moonAdd), h('small', labels.moonId)]),
                h('div', { class: 'zt-join-control' }, [
                  h(NInput, { value: newMoonID.value, size: 'medium', maxlength: 10, placeholder: labels.moonPlaceholder, status: newMoonIDError.value ? 'error' : undefined, disabled: Boolean(busy.value), 'onUpdate:value': (value) => { newMoonID.value = value }, onKeyup: (event) => { if (event.key === 'Enter') addMoon() } }),
                  h(NButton, { type: 'primary', size: 'medium', loading: busy.value === 'moon-add', disabled: !moonIDPattern.test(normalizedNewMoonID.value) || moons.value.includes(normalizedNewMoonID.value) || Boolean(busy.value && busy.value !== 'moon-add'), onClick: addMoon }, { default: () => labels.moonAdd }),
                  h('small', { class: newMoonIDError.value ? 'zt-error' : '', 'aria-hidden': newMoonIDError.value ? undefined : 'true' }, newMoonIDError.value || '\u00a0'),
                ]),
              ]),
              h(NSpin, { show: busy.value === 'refresh' && moons.value.length === 0 }, { default: () => h('div', { class: 'zt-list' }, moons.value.length ? moons.value.map(moonCard) : [h('div', { class: 'zt-empty' }, labels.moonEmpty)]) }),
            ]) }),
            h(NTabPane, { name: 'options', tab: labels.options, tabProps: advancedTabProps('options'), id: 'zt-panel-options', role: 'tabpanel', 'aria-labelledby': 'zt-tab-options', displayDirective: 'show' }, { default: () => h('article', { class: 'zt-options' }, [
              h('div', { class: 'zt-option-grid' }, [
                h('label', { class: 'zt-port' }, [h('span', labels.port), h(NInputNumber, { value: port.value, min: 0, max: 65535, disabled: Boolean(busy.value), 'onUpdate:value': (value) => { port.value = value ?? 0 } })]),
                ...[[labels.managed, allowManaged], [labels.global, allowGlobal], [labels.defaultRoute, allowDefault], [labels.dns, allowDNS]].map(([label, value]) => h('label', { class: 'zt-switch', key: label }, [h('span', label), h(NSwitch, { value: value.value, disabled: Boolean(busy.value), 'onUpdate:value': (next) => { value.value = next } })])),
              ]),
              h('div', { class: 'zt-save' }, [h(NButton, { type: 'primary', loading: busy.value === 'save', disabled: !dirty.value || !valid.value || Boolean(busy.value && busy.value !== 'save'), onClick: saveOptions }, { default: () => labels.save })]),
            ]) }),
          ] }),
        ]),
      ])
    },
  })

  runtime.register('zerotier', {
    apiVersion: 1,
    component: Page,
    styles: [`
      .zt-page { display: grid; gap: 14px; }
      .zt-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .zt-heading h2 { margin: 0; font-size: 18px; }
      .zt-heading p { margin: 5px 0 0; color: var(--n-text-color-3, #888); }
      .zt-heading-actions { display: flex; align-items: center; gap: 12px; }
      .zt-node-id { display: grid; justify-items: end; gap: 2px; white-space: nowrap; }
      .zt-node-id small { color: var(--n-text-color-3, #888); }
      .zt-join { display: grid; grid-template-columns: minmax(150px, .4fr) minmax(240px, 1fr); align-items: start; gap: 12px; padding: 14px; border: 1px solid var(--n-border-color, #444); border-radius: 8px; }
      .zt-join > div:first-child { display: grid; gap: 4px; }
      .zt-join small, .zt-network-copy > small { color: var(--n-text-color-3, #888); }
      .zt-join-control { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 2px 12px; }
      .zt-join-control > .n-input, .zt-join-control > .n-button { align-self: center; height: 34px; }
      .zt-join-control > small { grid-column: 1 / -1; min-height: 16px; line-height: 16px; }
      .zt-error { color: var(--n-color-error, #d03050) !important; }
      .zt-list { display: grid; gap: 10px; }
      .zt-advanced { min-width: 0; border: 1px solid var(--n-border-color, #444); border-radius: 8px; }
      .zt-advanced > summary { padding: 14px; font-weight: 600; cursor: pointer; }
      .zt-advanced-tabs { padding: 0 14px 14px; }
      .zt-moons { display: grid; gap: 10px; }
      .zt-moon-description { margin: 0; color: var(--n-text-color-3, #888); }
      .zt-empty { padding: 24px; border: 1px dashed var(--n-border-color, #444); border-radius: 8px; color: var(--n-text-color-3, #888); text-align: center; }
      .zt-network { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--n-border-color, #444); border-radius: 8px; }
      .zt-network-copy { display: grid; gap: 5px; min-width: 0; }
      .zt-network-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .zt-network-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .zt-addresses { display: flex; flex-wrap: wrap; gap: 6px; }
      .zt-node-id code, .zt-addresses code, .zt-network-copy > code { color: var(--n-text-color-1, #e5e7eb); font-family: var(--onekvm-font-mono, ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace); font-size: 13px; font-feature-settings: "tnum" 1, "zero" 1; font-variant-numeric: tabular-nums slashed-zero; font-weight: 500; line-height: 1.5; letter-spacing: .01em; }
      .zt-pending { color: var(--n-text-color-3, #888); font-size: 12px; }
      .zt-options { display: grid; gap: 13px; }
      .zt-option-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
      .zt-option-grid > * { width: 100%; min-width: 0; }
      .zt-port { display: grid; gap: 7px; }
      .zt-switch { display: grid; gap: 7px; }
      .zt-switch .n-switch { justify-self: start; }
      .zt-save { display: flex; justify-content: flex-end; }
      @media (max-width: 760px) { .zt-heading { display: grid; } .zt-heading-actions { justify-content: space-between; } .zt-node-id { justify-items: start; } .zt-join, .zt-network { grid-template-columns: 1fr; } .zt-network > button { justify-self: end; } }
    `],
  })
})()
