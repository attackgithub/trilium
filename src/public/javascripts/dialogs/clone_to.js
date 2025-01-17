import noteAutocompleteService from "../services/note_autocomplete.js";
import utils from "../services/utils.js";
import cloningService from "../services/cloning.js";
import treeUtils from "../services/tree_utils.js";
import toastService from "../services/toast.js";
import treeCache from "../services/tree_cache.js";

const $dialog = $("#clone-to-dialog");
const $form = $("#clone-to-form");
const $noteAutoComplete = $("#clone-to-note-autocomplete");
const $clonePrefix = $("#clone-prefix");
const $noteList = $("#clone-to-note-list");

let clonedNoteIds;

export async function showDialog(noteIds) {
    clonedNoteIds = [];

    for (const noteId of noteIds) {
        if (!clonedNoteIds.includes(noteId)) {
            clonedNoteIds.push(noteId);
        }
    }

    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    $dialog.modal();

    $noteAutoComplete.val('').trigger('focus');

    $noteList.empty();

    for (const noteId of clonedNoteIds) {
        const note = await treeCache.getNote(noteId);

        $noteList.append($("<li>").text(note.title));
    }

    noteAutocompleteService.initNoteAutocomplete($noteAutoComplete);
    noteAutocompleteService.showRecentNotes($noteAutoComplete);
}

async function cloneNotesTo(notePath) {
    const targetNoteId = treeUtils.getNoteIdFromNotePath(notePath);

    for (const cloneNoteId of clonedNoteIds) {
        await cloningService.cloneNoteTo(cloneNoteId, targetNoteId, $clonePrefix.val());

        const clonedNote = await treeCache.getNote(cloneNoteId);
        const targetNote = await treeCache.getNote(targetNoteId);

        toastService.showMessage(`Note "${clonedNote.title}" has been cloned into ${targetNote.title}`);
    }
}

$form.on('submit', () => {
    const notePath = $noteAutoComplete.getSelectedPath();

    if (notePath) {
        $dialog.modal('hide');

        cloneNotesTo(notePath);
    }
    else {
        console.error("No path to clone to.");
    }

    return false;
});