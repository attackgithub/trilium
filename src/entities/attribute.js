"use strict";

const Entity = require('./entity');
const repository = require('../services/repository');
const dateUtils = require('../services/date_utils');
const sql = require('../services/sql');

/**
 * Attribute is key value pair owned by a note.
 *
 * @property {string} attributeId
 * @property {string} noteId
 * @property {string} type
 * @property {string} name
 * @property {string} value
 * @property {int} position
 * @property {boolean} isInheritable
 * @property {boolean} isDeleted
 * @property {string} utcDateCreated
 * @property {string} utcDateModified
 *
 * @extends Entity
 */
class Attribute extends Entity {
    static get entityName() { return "attributes"; }
    static get primaryKeyName() { return "attributeId"; }
    static get hashedProperties() { return ["attributeId", "noteId", "type", "name", "value", "isInheritable", "isDeleted", "utcDateCreated"]; }

    constructor(row) {
        super(row);

        this.isInheritable = !!this.isInheritable;

        if (this.isDefinition()) {
            try {
                this.value = JSON.parse(this.value);
            }
            catch (e) {
            }
        }
    }

    /**
     * @returns {Promise<Note|null>}
     */
    async getNote() {
        if (!this.__note) {
            this.__note = await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
        }

        return this.__note;
    }

    /**
     * @returns {Promise<Note|null>}
     */
    async getTargetNote() {
        if (this.type !== 'relation') {
            throw new Error(`Attribute ${this.attributeId} is not relation`);
        }

        if (!this.value) {
            return null;
        }

        if (!this.__targetNote) {
            this.__targetNote = await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.value]);
        }

        return this.__targetNote;
    }

    /**
     * @return {boolean}
     */
    isDefinition() {
        return this.type === 'label-definition' || this.type === 'relation-definition';
    }

    async beforeSaving() {
        if (!this.value) {
            if (this.type === 'relation') {
                throw new Error(`Cannot save relation ${this.name} since it does not target any note.`);
            }

            // null value isn't allowed
            this.value = "";
        }

        if (this.position === undefined) {
            this.position = 1 + await sql.getValue(`SELECT COALESCE(MAX(position), 0) FROM attributes WHERE noteId = ?`, [this.noteId]);
        }

        if (!this.isInheritable) {
            this.isInheritable = false;
        }

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.utcDateCreated) {
            this.utcDateCreated = dateUtils.utcNowDateTime();
        }

        super.beforeSaving();

        if (this.isChanged) {
            this.utcDateModified = dateUtils.utcNowDateTime();
        }
    }

    // cannot be static!
    updatePojo(pojo) {
        delete pojo.isOwned;
    }
}

module.exports = Attribute;