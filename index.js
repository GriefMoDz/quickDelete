const { Plugin } = require('powercord/entities');
const { forceUpdateElement, getOwnerInstance, waitFor } = require('powercord/util');
const { getModule, messages, constants: { Permissions } } = require('powercord/webpack');
const { inject, uninject } = require('powercord/injector');

module.exports = class QuickDelete extends Plugin {
  async startPlugin () {
    this.messageClasses = (await getModule([ 'container', 'messageCompact' ]));
    this.messageQuery = `.${this.messageClasses.content.replace(/ /g, '.')}`;
    this.patchMessageContent();
  }

  pluginWillUnload () {
    uninject('pc-quickDelete-MessageContent');
    forceUpdateElement(this.messageQuery, true);
  }

  async patchMessageContent () {
    const _this = this;
    const instance = getOwnerInstance(await waitFor(this.messageQuery));

    const permissions = (await getModule([ 'getChannelPermissions' ]));
    const currentUser = (await getModule([ 'getCurrentUser' ])).getCurrentUser();

    function renderMessage (_, res) {
      const { message, channel } = this.props;
      const hasDeletePermission = permissions.can(Permissions.MANAGE_MESSAGES, channel);

      if (hasDeletePermission || message.author.id === currentUser.id) {
        res.props.onClick = _this.handleMessageDelete(channel.id, message.id);
      }

      return res;
    }

    inject('pc-quickDelete-MessageContent', instance.__proto__, 'render', renderMessage);
    forceUpdateElement(this.messageQuery, true);
  }

  handleMessageDelete (channelId, messageId) {
    return (e) => {
      if (e.ctrlKey) {
        messages.deleteMessage(channelId, messageId, false);
      }
    };
  }
};
