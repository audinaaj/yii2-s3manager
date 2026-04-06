<?php

namespace skylineos\yii\s3manager\widgets;

use yii\base\Widget;
use skylineos\yii\s3manager\Module as skyS3Module;
use skylineos\yii\s3manager\assets\MediaManagerAsset;

class MediaManagerModal extends Widget
{
    /**
     * This should be set here, in params, or in the module config
     *
     * @var string $s3bucket The s3 bucket to use.
     */
    public $s3bucket;

    /**
     * This should be set here, in params, or in the module config
     *
     * @var string $s3region The region in which the $s3bucket exists, example 'us-east-1'
     */
    public $s3region;

    /**
     * @var string $s3prefix The s3 prefix to use. Can be any base folder
     */
    public $s3prefix = null;

    /**
     * @var array $s3credentials AWS credentials with 'key' and 'secret'
     */
    public $s3credentials = null;

    /**
     * @var string $s3endpoint Custom S3 endpoint for non-AWS providers (e.g., DigitalOcean Spaces)
     */
    public $s3endpoint = null;

    /**
     * @inheritdoc
     */
    public function init()
    {
        parent::init();

        if ($this->s3bucket === null) {
            $this->s3bucket = isset(\Yii::$app->params['s3bucket'])
                ? \Yii::$app->params['s3bucket']
                : \Yii::$app->modules['s3manager']->configuration['bucket'];
        }

        if ($this->s3region === null) {
            $this->s3region = isset(\Yii::$app->params['s3region'])
                ? \Yii::$app->params['s3region']
                : \Yii::$app->modules['s3manager']->configuration['region'];
        }

        if ($this->s3prefix === null) {
            if (isset(\Yii::$app->params['s3prefix'])) {
                $this->s3prefix = \Yii::$app->params['s3prefix'];
            } elseif (isset(\Yii::$app->modules['s3manager']->configuration['prefix'])) {
                $this->s3prefix = \Yii::$app->modules['s3manager']->configuration['prefix'];
            }
        }

        if ($this->s3credentials === null) {
            if (isset(\Yii::$app->params['s3credentials'])) {
                $this->s3credentials = \Yii::$app->params['s3credentials'];
            } elseif (isset(\Yii::$app->modules['s3manager']->configuration['credentials'])) {
                $this->s3credentials = \Yii::$app->modules['s3manager']->configuration['credentials'];
            }
        }

        if ($this->s3endpoint === null) {
            if (isset(\Yii::$app->modules['s3manager']->configuration['endpoint'])) {
                $this->s3endpoint = \Yii::$app->modules['s3manager']->configuration['endpoint'];
            }
        }
    }

    /**
     * Renders the media manager wrapped in a modal
     * @return [type] [description]
     */
    public function run()
    {
        MediaManagerAsset::register($this->view);

        \Yii::$app->session->set(skyS3Module::SESSION_BUCKET_KEY, $this->s3bucket);
        \Yii::$app->session->set(skyS3Module::SESSION_REGION_KEY, $this->s3region);
        \Yii::$app->session->set(skyS3Module::SESSION_PREFIX_KEY, $this->s3prefix);
        
        // Set credentials in session if available
        if ($this->s3credentials !== null) {
            \Yii::$app->session->set(skyS3Module::SESSION_BUCKET_KEY . '_creds', $this->s3credentials);
        }
        
        // Set endpoint in session if available
        if ($this->s3endpoint !== null) {
            \Yii::$app->session->set(skyS3Module::SESSION_BUCKET_KEY . '_endpoint', $this->s3endpoint);
        }

        return $this->renderFile('@vendor/skylineos/yii2-s3manager/views/default/modal.php', []);
    }
}
