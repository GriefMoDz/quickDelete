const { Plugin } = require('powercord/entities');
const { getOwnerInstance, waitFor } = require('powercord/util');
const { contextMenu, getModule } = require('powercord/webpack');
const { inject, uninject } = require('powercord/injector');

module.exports = class QuickDelete extends Plugin {

    async startPlugin() {
        this.patchMessageContent();
    }

    pluginWillUnload() {
        uninject('pc-quickDelete-MessageContent');
    }

    async patchMessageContent() {
        const _this = this;

        const messageClasses = await getModule(['messageCompact', 'messageCozy']);
        const permissions = await require('powercord/webpack').getModule(['getChannelPermissions'])
        const messageQuery = `.${messageClasses.message.replace(/ /g, '.')}`;

        const instance = getOwnerInstance(await waitFor(messageQuery));
        const currentUser = (await getModule(['getCurrentUser'])).getCurrentUser();


        function renderMessage(_, res) {
            const { message, channel } = this.props;

            const deletePermission = permissions.can(require('powercord/webpack').constants.Permissions.MANAGE_MESSAGES, channel);

            if (deletePermission || message.author.id === currentUser.id) {
                res.props.onMouseUp = _this.handleMessageDelete(channel.id, message.id);
            }

            return res;
        }

        inject('pc-quickDelete-MessageContent', instance.__proto__, 'render', renderMessage);

        this.forceUpdate(messageQuery);
    }

    handleMessageDelete(channelId, messageId) {
        return async (e) => {
            if (e.ctrlKey == true) {
                require('powercord/webpack').messages.deleteMessage(channelId, messageId, false)
            }
        }
    }

    /*
    * DISCLAIMER: the following method was taken from .intrnl#6380's 'blackboxTags'
    * plug-in - this section of code does not belong to me.
    */
    forceUpdate(query) {
        const elements = [
            ...document.querySelectorAll(query)
        ];

        for (const elem of elements) {
            const instance = getOwnerInstance(elem);
            instance.forceUpdate();
        }
    }
}