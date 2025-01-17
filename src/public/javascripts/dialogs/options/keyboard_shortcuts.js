import server from "../../services/server.js";
import utils from "../../services/utils.js";

const TPL = `
<h4>Keyboard shortcuts</h4>

<div style="overflow: auto; height: 500px;">
    <table id="keyboard-shortcut-table" cellpadding="10">
    <thead>
        <tr>
            <th>Action name</th>
            <th>Shortcuts</th>
            <th>Default shortcuts</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody></tbody>
    </table>
</div>

<div style="display: flex; justify-content: space-between">
    <button class="btn btn-primary" id="options-keyboard-shortcuts-reload-app">Reload app to apply changes</button>
    
    <button class="btn" id="options-keyboard-shortcuts-set-all-to-default">Set all shortcuts to the default</button>
</div>
`;

export default class KeyboardShortcutsOptions {
    constructor() {
        $("#options-keyboard-shortcuts").html(TPL);

        $("#options-keyboard-shortcuts-reload-app").on("click", () => utils.reloadApp());

        const $table = $("#keyboard-shortcut-table tbody");

        server.get('keyboard-actions').then(actions => {
            for (const action of actions) {
                const $tr = $("<tr>");

                if (action.separator) {
                    $tr.append(
                        $('<td colspan="4">')
                            .attr("style","background-color: var(--accented-background-color); font-weight: bold;")
                            .text(action.separator)
                    )
                }
                else {
                    $tr.append($("<td>").text(action.actionName))
                        .append($("<td>").append(
                            $(`<input type="text" class="form-control">`)
                                .val(action.effectiveShortcuts.join(", "))
                                .attr('data-keyboard-action-name', action.actionName)
                                .attr('data-default-keyboard-shortcuts', action.defaultShortcuts.join(", "))
                            )
                        )
                        .append($("<td>").text(action.defaultShortcuts.join(", ")))
                        .append($("<td>").text(action.description));
                }

                $table.append($tr);
            }
        });

        $table.on('change', 'input.form-control', e => {
            const $input = $(e.target);
            const actionName = $input.attr('data-keyboard-action-name');
            const shortcuts = $input.val()
                              .replace('+,', "+Comma")
                              .split(",")
                              .map(shortcut => shortcut.replace("+Comma", "+,"))
                              .filter(shortcut => !!shortcut);

            const opts = {};
            opts['keyboardShortcuts' + actionName] = JSON.stringify(shortcuts);

            server.put('options', opts);
        });

        $("#options-keyboard-shortcuts-set-all-to-default").on('click', async () => {
            const confirmDialog = await import('../confirm.js');

            if (!await confirmDialog.confirm("Do you really want to reset all keyboard shortcuts to the default?")) {
                return;
            }

            $table.find('input.form-control').each(function() {
                const defaultShortcuts = $(this).attr('data-default-keyboard-shortcuts');

                if ($(this).val() !== defaultShortcuts) {
                    $(this)
                        .val(defaultShortcuts)
                        .trigger('change');
                }
            });
        });
    }
}