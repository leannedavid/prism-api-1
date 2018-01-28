'use strict';

const mongoose = require('mongoose');
const winston = require('winston');
const _ = require('lodash');

const settings = require('../lib/config/settings');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  revisions: {
    type: [{
      message: {
        type: String,
        required: true
      },
      filename: String,
      fileExtension: String,
      dateUploaded: {
        type: Date,
        default: Date.now
      },
      uploader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      template: Boolean,
      deleted: Boolean
    }],
    default: []
  },
  comments: {
    type: [{
      text: {
        type: String,
        required: true,
        maxLength: settings.maxCommentLength
      },
      author: {
        type: {
          _id: mongoose.Schema.Types.ObjectId,
          username: {type: String, required: true},
          name: {
            first: {type: String, required: true},
            last: {type: String, required: true}
          }
        },
        required: true
      },
      creationDate: {
        type: String,
        required: true
      },
      revision: {
        type: Number,
        required: true
      }
    }],
    default: []
  }
});

documentSchema.methods.validRevision = function(index, allowDeleted = false) {
  return index >= 0 && index < this.revisions.length && (allowDeleted || !this.revisions[index].deleted);
};

documentSchema.methods.addRevision = function(message, uploader) {
  this.revisions.push({
    'message': message,
    'filename': null,
    'uploader': uploader
  });
};

documentSchema.methods.setDeleted = function(toDelete, deleted) {
  const index = Number.parseInt(toDelete);
  return new Promise((resolve, reject) => {
    if (isNaN(index)) {
      reject(new Error('Index must be a number'));
      return;
    }
    if (deleted !== undefined && !this.validRevision(index)) {
      reject(new Error('Invalid revision index'));
      return;
    }
    if (this.revisions[index].template) {
      reject(new Error('Attempted to set deleted on template revision'));
      return;
    }
    this.revisions[index].deleted = deleted;
    this.save().then(() => {
      resolve();
      winston.info(`Successfully set deleted for revision ${index} on document with id ${this._id.toString()}`);
    }, function(err) {
      reject(err);
    });
  });
};

documentSchema.methods.excludeFields = function() {
  const object = this.toObject();
  object.revisions = _.map(object.revisions, (revision) => {
    if (revision.deleted) {
      return {
        message: 'Deleted revision',
        deleted: true
      };
    } else {
      return _.omit(revision, ['filename']);
    }
  });
  return object;
};
documentSchema.methods.validComment = function(index, allowDeleted = false) {
  return index >= 0 && index < this.comments.length && (allowDeleted || !this.comments[index].deleted);
};

documentSchema.methods.deleteComment = function(toDelete, deleted) {
  const commentIndex = Number.parseInt(toDelete);
  return new Promise((resolve, reject) => {
    if (isNaN(commentIndex)) {
      reject(new Error('Index must be a number'));
      return;
    }
    if (deleted !== undefined && !this.validComment(commentIndex)) {
      reject(new Error('Invalid comment index'));
      return;
    }

    this.comments[commentIndex].deleted = deleted;
    this.save().then(() => {
      resolve();
      winston.info(`Successfully set deleted for comment ${commentIndex} on document with id ${this._id.toString()}`);
    }, function(err) {
      reject(err);
    });
  });
};
module.exports = mongoose.model('Document', documentSchema);
