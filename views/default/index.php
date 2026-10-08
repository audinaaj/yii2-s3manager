<?php

use yii\helpers\Html;
use skylineos\yii\s3manager\assets\MediaManagerAsset;

MediaManagerAsset::register($this);
?>
<div class="m-portlet m-portlet--bordered m-portlet--unair" id="mm__wrapper">
    <div class="m-portlet__body">
        <div class="col" id="folderColumn">
            <p class="lead"><i class="fas fa-folder"></i> Folders</p>
            <div id="folderTree" tabindex="0"></div>
            <hr>
            <?= Html::beginForm(['/s3manager/default/upload'], 'post', [
                'enctype' => 'multipart/form-data',
                'id' => 's3mm-file-upload-form',
                'style' => 'margin-bottom: 0;'
                ]) ?>
            
            <div class="btn btn-info" data-dz-message>
                <span>
                    <i class="fas fa-cloud-upload-alt"></i> 
                    Upload File
                </span>
            </div>
            <?= Html::hiddenInput('s3mm-upload-path', '/', ['id' => 's3mm-upload-path']) ?>

            <?= Html::endForm() ?>
            <hr>
        </div>
        <div class="col" id="fileColumn">
            <div id="s3mm-file-details" class="d-none">
                <p class="lead"><i class="fas fa-file"></i> File Details</p>
                <hr>
            </div>

            <div class="selected-file-section empty" id="selectedFileSection">
                <div class="selected-file-content">
                    <p style="margin: 0; font-size: 12px; color: #999;">No file selected</p>
                </div>
            </div>
            
            <table class="table table-striped table-hover" id="s3mm-object-list" tabindex="0">
                <thead>
                    <tr>
                        <th class="column_actions"></th>
                        <th class="column_fileName">File name</th>
                        <th class="column_lastModified">Last modified</th>
                        <th class="column_fileSize">File size</th>
                    </tr>
                </thead>
                <tbody id="files">

                </tbody>
            </table>

        </div>
    </div>
</div>