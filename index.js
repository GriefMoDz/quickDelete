const { Plugin } = require('powercord/entities');
const { getModule, messages, constants: { Permissions } } = require('powercord/webpack');
const { forceUpdateElement } = require('powercord/util');
const { inject, uninject } = require('powercord/injector');

module.exports = class QuickDelete extends Plugin {
  constructor () {
    super();

    this.state = {
      hoveredMessage: null,
      isHoldingDelete: false
    };
  }

  async startPlugin () {
    this.messageClasses = await getModule([ 'messages', 'scroller' ]);
    this.deleteListener = (e) => {
      if (e.key === 'Delete') {
        if (this.state.isHoldingDelete) {
          return this.state.isHoldingDelete = false;
        }

        this.state.isHoldingDelete = true;

        if (this.state.hoveredMessage) {
          const { hoveredMessage } = this.state;
          this.handleMessageDelete(hoveredMessage.channel, hoveredMessage.message).call(this, e);
        }
      }
    };

    this.patchReportMessage();
    this.patchMessageContent();

    document.addEventListener('keydown', this.deleteListener);
    document.addEventListener('keyup', this.deleteListener);
  }

  pluginWillUnload () {
    const report = getModule([ 'canReportInChannel' ], false);
    report.canReportMessage = report.__canReportMessage;

    uninject('quickDelete-MessageContent');
    forceUpdateElement(`.${this.messageClasses.message}`, true);

    document.removeEventListener('keydown', this.deleteListener);
    document.removeEventListener('keyup', this.deleteListener);
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
    const permissions = await getModule([ 'getChannelPermissions' ]);
    const currentUser = (await getModule([ 'getCurrentUser' ])).getCurrentUser();

    const renderMessage = (args, res) => {
      const { childrenAccessories: { props: { message, channel } } } = args[0];
      const hasDeletePermission = permissions.can(Permissions.MANAGE_MESSAGES, channel);

      if (hasDeletePermission || message.author.id === currentUser.id) {
        res.props.onClick = this.handleMessageDelete(channel, message);
        res.props.onMouseOver = () => this.state.hoveredMessage = { channel, message };
        res.props.onMouseLeave = () => this.state.hoveredMessage = null;
      }

      return res;
    };

    const Message = await getModule(m => m.default && m.default.displayName === 'Message');
    inject('quickDelete-MessageContent', Message, 'default', renderMessage);

    Message.default.displayName = 'Message';

    forceUpdateElement(`.${this.messageClasses.message}`, true);
  }

  handleMessageDelete (channel, message) {
    messages.confirmDelete = getModule([ 'confirmDelete' ], false).confirmDelete;

    return (e) => {
      if (e.shiftKey && e.ctrlKey) {
        messages.deleteMessage(channel.id, message.id, false);
      } else if (e.ctrlKey || this.state.isHoldingDelete) {
        messages.confirmDelete(channel, message, e.ctrlKey);

        const tipClass = `.${getModule([ 'inline', 'tip' ], false).tip.split(' ')[0]}`;

        setTimeout(() => {
          const tip = document.querySelector(tipClass);

          if (tip) {
            tip.innerHTML = 'You can hold down shift before clicking a message that you want ' +
            'to delete to bypass this confirmation entirely.';
          }
        }, 100);
      }
    };
  }
};
