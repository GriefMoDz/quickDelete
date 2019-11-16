const { Plugin } = require('powercord/entities');
const { forceUpdateElement, getOwnerInstance, waitFor } = require('powercord/util');
const { getModule, messages, constants: { Permissions } } = require('powercord/webpack');
const { inject, uninject } = require('powercord/injector');

module.exports = class QuickDelete extends Plugin {
  async startPlugin () {
    this.messageClasses = await getModule([ 'container', 'messageCompact' ]);
    this.messageQuery = `.${this.messageClasses.container.split(' ')[0]} > div`;
    this.patchReportMessage();
    this.patchMessageContent();
  }

  pluginWillUnload () {
    const report = getModule([ 'canReportInChannel' ], false);
    report.canReportMessage = report.__canReportMessage;

    uninject('quickDelete-MessageContent');
    forceUpdateElement(this.messageQuery, true);
  }

  async patchReportMessage () {
    const report = await getModule([ 'canReportInChannel' ]);
    const id = (await getModule([ 'getId' ])).getId();

    report.canReportMessage = (canReportMessage => (message) => {
      if (message && message.author.id !== id) {
        return true;
      }

      return canReportMessage(message);
    })(report.__canReportMessage = report.canReportMessage);
  }

  async patchMessageContent () {
    const _this = this;
    const instance = getOwnerInstance(await waitFor(this.messageQuery));

    const permissions = await getModule([ 'getChannelPermissions' ]);
    const currentUser = (await getModule([ 'getCurrentUser' ])).getCurrentUser();

    function renderMessage (_, res) {
      const { message, channel } = this.props;
      const hasDeletePermission = permissions.can(Permissions.MANAGE_MESSAGES, channel);

      if (hasDeletePermission || message.author.id === currentUser.id) {
        res.props.onClick = _this.handleMessageDelete(channel, message);
      }

      return res;
    }

    inject('quickDelete-MessageContent', instance.__proto__, 'render', renderMessage);
    forceUpdateElement(this.messageQuery, true);
  }

  handleMessageDelete (channel, message) {
    let isHoldingDelete = false;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete') {
        isHoldingDelete = true;
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Delete') {
        isHoldingDelete = false;
      }
    });

    messages.confirmDelete = getModule([ 'confirmDelete' ], false).confirmDelete;

    return (e) => {
      if ((e.shiftKey && e.ctrlKey) || isHoldingDelete) {
        messages.deleteMessage(channel.id, message.id, false);
      } else if (e.ctrlKey) {
        messages.confirmDelete(channel, message, true);

        const tipClass = `.${getModule([ 'inline', 'tip' ], false).tip.split(' ')[0]}`;

        setTimeout(() => {
          const tip = document.querySelector(tipClass);
          if (tip) {
            tip.innerHTML = 'You can hold down shift before clicking a message that you want to delete to bypass this confirmation entirely.';
          }
        }, 100);
      }
    };
  }
};
