// ==================== 激活码/机器码黑名单管理模块 ====================
// 用于白嫖模式的黑名单管理
// @author ygw

import { showToast } from './ui.js';

export const licensesMixin = {
    data() {
        return {
            // 黑名单列表
            blockedLicenses: [],
            licensesLoading: false,
            
            // 视图模式：all/machine_id/license_key
            licenseViewMode: 'all',
            
            // 添加黑名单表单
            newBlockLicense: {
                type: 'machine_id',
                value: '',
                reason: ''
            },
            
            // 解封确认弹窗
            showUnblockLicenseModal: false,
            unblockLicenseTarget: null,
            
            // 添加黑名单弹窗
            showAddLicenseModal: false
        };
    },

    computed: {
        // 根据视图模式过滤黑名单列表
        filteredBlockedLicenses() {
            if (!this.blockedLicenses || this.blockedLicenses.length === 0) return [];
            if (this.licenseViewMode === 'all') {
                return this.blockedLicenses;
            }
            return this.blockedLicenses.filter(item => item.type === this.licenseViewMode);
        },
        
        // 机器码数量
        machineIdCount() {
            return this.blockedLicenses.filter(item => item.type === 'machine_id').length;
        },
        
        // 激活密钥数量
        licenseKeyCount() {
            return this.blockedLicenses.filter(item => item.type === 'license_key').length;
        }
    },

    methods: {
        // 加载黑名单列表
        async handleLoadBlockedLicenses() {
            this.licensesLoading = true;
            try {
                const response = await fetch('/v2/licenses/blocked', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('adminPassword')}` }
                });
                const data = await response.json();
                this.blockedLicenses = data.data || [];
            } catch (error) {
                console.error('加载黑名单失败:', error);
                showToast(this, '加载黑名单失败', 'error');
            } finally {
                this.licensesLoading = false;
            }
        },

        // 打开添加黑名单弹窗
        openAddLicenseModal() {
            this.newBlockLicense = {
                type: 'machine_id',
                value: '',
                reason: ''
            };
            this.showAddLicenseModal = true;
        },

        // 关闭添加黑名单弹窗
        closeAddLicenseModal() {
            this.showAddLicenseModal = false;
        },

        // 添加到黑名单
        async handleBlockLicense() {
            if (!this.newBlockLicense.value.trim()) {
                showToast(this, '请输入机器码或激活密钥', 'warning');
                return;
            }

            // 保存表单数据（弹窗关闭后仍需要）
            const blockData = {
                type: this.newBlockLicense.type,
                value: this.newBlockLicense.value.trim(),
                reason: this.newBlockLicense.reason.trim() || '检测到多个机器使用'
            };

            // 测试模式需要密码
            const doBlock = async (testPassword) => {
                const headers = {
                    'Authorization': `Bearer ${localStorage.getItem('adminPassword')}`,
                    'Content-Type': 'application/json'
                };
                if (testPassword) {
                    headers['X-Test-Password'] = testPassword;
                }
                const response = await fetch('/v2/licenses/block', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(blockData)
                });
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(text);
                }
                return await response.json();
            };

            try {
                // 先关闭添加弹窗，避免遮挡测试密码弹窗
                this.closeAddLicenseModal();
                const data = await this.withTestPassword('添加黑名单', doBlock);
                if (data === null) return; // 用户取消
                showToast(this, data.message || '添加黑名单成功', 'success');
                await this.handleLoadBlockedLicenses();
            } catch (error) {
                console.error('添加黑名单失败:', error);
                if (error.message && error.message.includes('TEST_MODE_PASSWORD_REQUIRED')) {
                    showToast(this, '操作密码错误', 'error');
                } else {
                    showToast(this, '添加黑名单失败', 'error');
                }
            }
        },

        // 打开解封确认弹窗
        handleUnblockLicense(license) {
            this.unblockLicenseTarget = license;
            this.showUnblockLicenseModal = true;
        },

        // 关闭解封确认弹窗
        closeUnblockLicenseModal() {
            this.showUnblockLicenseModal = false;
            this.unblockLicenseTarget = null;
        },

        // 确认解封
        async confirmUnblockLicense() {
            if (!this.unblockLicenseTarget) return;

            const target = this.unblockLicenseTarget;
            
            // 测试模式需要密码
            const doUnblock = async (testPassword) => {
                const headers = {
                    'Authorization': `Bearer ${localStorage.getItem('adminPassword')}`,
                    'Content-Type': 'application/json'
                };
                if (testPassword) {
                    headers['X-Test-Password'] = testPassword;
                }
                const response = await fetch('/v2/licenses/unblock', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: target.type,
                        value: target.value
                    })
                });
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(text);
                }
                return await response.json();
            };

            try {
                this.closeUnblockLicenseModal(); // 先关闭确认弹窗
                const data = await this.withTestPassword('移除黑名单', doUnblock);
                if (data === null) return; // 用户取消
                showToast(this, data.message || '移除黑名单成功', 'success');
                await this.handleLoadBlockedLicenses();
            } catch (error) {
                console.error('移除黑名单失败:', error);
                if (error.message && error.message.includes('TEST_MODE_PASSWORD_REQUIRED')) {
                    showToast(this, '操作密码错误', 'error');
                } else {
                    showToast(this, '移除黑名单失败', 'error');
                }
            }
        },

        // 格式化黑名单时间
        formatLicenseTime(timestamp) {
            if (!timestamp) return '-';
            return new Date(timestamp).toLocaleString('zh-CN');
        },

        // 获取类型显示名称
        getLicenseTypeName(type) {
            return type === 'machine_id' ? '机器码' : '激活密钥';
        },

        // 获取类型图标
        getLicenseTypeIcon(type) {
            return type === 'machine_id' ? 'ri-computer-line' : 'ri-key-2-line';
        },

        // 截断显示值（用于长字符串）
        truncateLicenseValue(value, maxLen = 24) {
            if (!value) return '-';
            if (value.length <= maxLen) return value;
            return value.substring(0, maxLen) + '...';
        }
    }
};
