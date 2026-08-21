<?php

use yii\helpers\Html;
use skylineos\yii\s3manager\assets\MediaManagerAsset;

MediaManagerAsset::register($this);
?>
<div class="m-portlet m-portlet--bordered m-portlet--unair" id="mm__wrapper">
    <div class="m-portlet__body">
        <div class="col">
            <p class="lead">Folders</p>
            <div id="folderTree"></div>
            <hr>
            <?= Html::beginForm(['/s3manager/default/upload'], 'post', [
                'enctype' => 'multipart/form-data',
                'id' => 's3mm-file-upload-form'
                ]) ?>
            
            <div class="dz-message btn btn-info" data-dz-message>
                <span>
                    <i class="fas fa-cloud-upload-alt"></i> 
                    Upload File
                </span>
            </div>
            <?= Html::hiddenInput('s3mm-upload-path', '/', ['id' => 's3mm-upload-path']) ?>

            <?= Html::endForm() ?>
            <hr>
        </div>
        <div class="col">
            <div id="s3mm-file-details" class="d-none">
                <p class="lead">File Details</p>
                <hr>
            </div>

            <div class="col-md-12">
                <span>
                <i class="fas fa-folder-open"></i> 
                <span id="s3mm-object-path-display" class="text-info">/</span>
                </span>
            </div>

            <div class="col-md-12">
                <span id="s3mm-file-url-display"></span> 
                <span class="text-info">
                    &nbsp;&nbsp;<i class="fas fa-copy invisible" id="s3mm-copy-file-uri"></i>
                </span>
                
                <hr>
            </div>
            
            <table class="table table-striped table-hover" id="s3mm-object-list">
                <thead>
                    <tr>
                        <th class="column_actions"></th>
                        <th class="column_fileName">File name</th>
                        <th class="column_lastModified">Last modified</>
                        <th class="column_fileSize text-right">File size</th>
                    </tr>
                </thead>
                <tbody id="files">

                </tbody>
            </table>

        </div>
    </div>
</div>